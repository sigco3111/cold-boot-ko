/**
 * Level 6's dialogue (stage 3d §6.2): the FACTS a line's condition may ask and the RULES table — one entry per id in
 * `voice/lines.l6.json` (R3), plus the reused 3c soldier barks (`l5_sol_*`, read from `lines.l5.json`). The channel is the
 * shared one (src/story/stage/dialogue.ts); a rule is evaluated when the line STARTS, never when it is queued. Variants
 * are `else` chains, each with its own rule. `U` lines are pure reactions (a panel answering a press, a line of a sequence
 * on its own clock); everything that names a place, a sight, a state or an earlier line is `C`.
 *
 * The boss / ending facts (`stage`, `loaderInView`, `inEnding`, …) are supplied by `boss.ts` / `scenes.ts` (ST-b); the
 * rules for those lines are written here against them so the table stays one-per-id.
 *
 * The level-6 lines are not in the shared story DB (src/story/voice.ts reads lines.l1 … l4): this file reads
 * `lines.l6.json` itself (with `label`, `cut`), and base.ts writes the subtitles from it.
 */
import { C, U, type DialogueConfig, type Rules } from '../stage/dialogue';
import type { CommonFacts } from '../stage/base';
import { voiceLine, type VoiceLine } from '../voice';
import type { PhaseId6 } from '../../level/l6/phases';
import l6raw from '../../../voice/lines.l6.json?raw';
import l5raw from '../../../voice/lines.l5.json?raw';

export type Line6 = VoiceLine & { label?: string; cut?: number };
/** Level 6's lines (with `label` / `cut`) + the reused 3c soldier barks (`l5_sol_*`). */
export const LINES6 = new Map<string, Line6>();
try { for (const l of JSON.parse(l6raw) as Line6[]) LINES6.set(l.id, l); } catch (e) { console.error('[story] lines.l6.json did not parse', e); }
try { for (const l of JSON.parse(l5raw) as Line6[]) if (l.id.startsWith('l5_sol_')) LINES6.set(l.id, l); } catch (e) { console.error('[story] lines.l5.json did not parse', e); }
export const line6 = (id: string): Line6 | undefined => LINES6.get(id) ?? voiceLine(id);

/** Subtitle label of a level-6 line (ui/subtitles.ts: KESSLER → radio, LT. AAS → phone, SOLDIER → CHOIR's colour). */
export function speaker6(l: Line6 | undefined): string {
  if (!l) return '';
  if (l.label) return l.label;
  switch (l.speaker) {
    case 'kessler': return '케슬러';
    case 'reyes': return '레예스';
    case 'choir': return 'CHOIR';
    case 'soldier': return '해군';
    case 'unit': return '유닛';
    case 'aas': return '아스 중위';
    case 'sunde': return 'A. 순데 박사';
    default: return l.speaker.toUpperCase();
  }
}
/** A radio line (the HUD strip is live while one plays). */
export const isRadio6 = (l: Line6 | undefined) => !!l && /^radio\b/.test(String(l.fx ?? ''));

/** The phases in story order (variants rank as their base). */
export const PHASE_ORDER6: PhaseId6[] = ['A', 'T', 'U', 'B', 'K'];
export function phaseRank6(p: PhaseId6): number {
  const base = p === 'B_hold' || p === 'U_man' || p === 'U_pull' ? 'B' : p === 'K_stores' || p === 'K_end' || p === 'nostory' ? 'K' : p;
  return PHASE_ORDER6.indexOf(base as PhaseId6);
}

/** The soldier a bark would come from (chosen by the script before the bark is asked). */
export interface Bark6 {
  id: number;
  /** Horizontal distance to the player (m). */
  dist: number;
  /** He has sight of the player now. */
  sees: boolean;
  /** He was hit within the last 3 s. */
  hitRecently: boolean;
  /** Another soldier died ≤ 4 s ago within 20 m of him. */
  felt: boolean;
  /** Seconds since he last saw the player while still aware of him (0 while he sees him). */
  lostFor?: number;
}

export interface Facts6 extends CommonFacts {
  readonly phase: PhaseId6;
  atLeast(p: PhaseId6): boolean;
  readonly choice: 'stop' | 'command';
  // ── the route (ST-a)
  readonly tubeLatched: boolean;
  /** F1 released and both of its soldiers alive. */
  readonly f1BothFree: boolean;
  /** Both F1 soldiers dead (spawned on this page or loaded past). */
  readonly f1SoldiersDead: boolean;
  readonly f2Spawned: boolean;
  /** A living F2 member (any of its three groups) is in view. */
  readonly f2InView: boolean;
  /** F3's soldier holding (pose hold) — at the door or walking out. */
  readonly f3Holding: boolean;
  /** Seconds F3's holding soldier has been in view at > 25 m with the lamp off. */
  readonly f3SeenFor: number;
  readonly manual: boolean;
  readonly bjOpen: boolean;
  readonly pulled: boolean;
  readonly shaftOpen: boolean;
  /** The queue was read and its note closed. */
  readonly queueClosed: boolean;
  readonly f4Spawned: boolean;
  readonly f4InView: boolean;
  /** Feet in vault6 (main floor or trench). */
  readonly inVault: boolean;
  /** Feet in he6 / vault6 / the trench. */
  readonly inHeVault: boolean;
  /** Feet in pool6 / shaft6 (Q always answers with the boss hint there). */
  readonly inPoolShaft: boolean;
  thudWithin(s: number): boolean;
  /** Seconds since `v6_shaft_lights` fired (∞ before). */
  readonly shaftLightsAgo: number;
  /** An awake hostile within `m` metres (holding soldiers excepted). */
  hostileWithin(m: number): boolean;
  readonly wastingRounds: boolean;
  readonly darkWithLight: boolean;
  readonly bark: Bark6 | null;
  // ── the boss and the end (supplied by boss.ts / scenes.ts, ST-b; stub values until then)
  readonly revealed: boolean;
  readonly hostile: boolean;
  readonly stage: number;
  readonly loaderAlive: boolean;
  readonly loaderInView: boolean;
  readonly onDock: boolean;
  readonly inCage: boolean;
  readonly soldierAlive: boolean;
  readonly floodLitFor: number;
  readonly floodAlive: boolean;
  readonly slamRecoveryInView: boolean;
  readonly ramsGone: number;
  readonly pinOut: boolean;
  /** 0 … 1. */
  readonly pressure: number;
  readonly trunkCut: boolean;
  readonly loaderDead: boolean;
  readonly quiet: boolean;
  /** `trunkCut && loaderDead`, the quiet reached, the console not yet used. */
  readonly endingPending: boolean;
  /** E1 / E2 running. */
  readonly inEnding: boolean;
  /** The queue was read at the head-end (fact `manifest`). */
  readonly manifestRead: boolean;
}

const stop = (F: Facts6) => F.choice === 'stop';
const command = (F: Facts6) => F.choice === 'command';
/** A choice pair: `<base>_stop` / `<base>_command`, each with the shared condition. */
function pair(rules: Rules<Facts6>, base: string, when: (F: Facts6) => boolean, why: string, extra: { once?: boolean; max?: number; cooldown?: number } = { once: true }): void {
  rules[`${base}_stop`] = C((F) => stop(F) && when(F), `stop; ${why}`, `${base}_command`, extra);
  rules[`${base}_command`] = C((F) => command(F) && when(F), `command; ${why}`, undefined, extra);
}
/** §6.2 bark gate, the speaker's part (3c `barkOk`); the script owns the 20 s spacing and "never over a Kessler line". */
const barkOk = (F: Facts6, range = 15) => !!F.bark && F.bark.sees && F.bark.dist <= range;
const heardAny = (F: Facts6, ...ids: string[]) => ids.some((i) => F.heard(i));

export const RULES6: Rules<Facts6> = {
  // ── arrival, tunnels (§4.1–§4.4)
  l6_kes_start: U('start + 0.6 (the arrival sequence)'),
  l6_unit_tube: U('d6_tube opens (the tube panel answers the cycle)'),
  l6_kes_start_2: C((F) => F.tubeLatched, 'the tube latched', undefined, { once: true }),
  l6_kes_contact_a: C((F) => F.f1BothFree, 'g6_tun_s released, both alive', undefined, { once: true }),
  l6_kes_tun_done: C((F) => F.f1SoldiersDead && F.hostiles === 0, 'g6_tun_s dead, calm', undefined, { once: true }),
  l6_kes_rep: C((F) => F.room === 'rep6' && F.hostiles === 0, 'first t6_rep, calm', undefined, { once: true }),
  l6_kes_contact_rep: C((F) => F.f2Spawned && !F.f2InView, 'F2 spawned, none of it in view', undefined, { once: true }),
  l6_kes_tunb: C((F) => F.room === 'tun6_b', 'first t6_tunb', undefined, { once: true }),
  l6_kes_tunb_soldier: C((F) => F.f3Holding && F.f3SeenFor >= 1, 'g6_tunb_s holding, in view ≥ 1 s at > 25 m, lamp off', undefined, { once: true }),
  // ── head-end (§4.5)
  l6_kes_he_1: C((F) => F.inHeVault, 'first t6_he', undefined, { once: true }),
  l6_kes_he_2: C((F) => !F.manual, 'not manual', 'l6_kes_he_2b', { once: true }),
  l6_kes_he_2b: C((F) => F.manual, 'manual (cranked during _1)', undefined, { once: true }),
  l6_reyes_he: C((F) => F.heard('l6_kes_he_2'), 'after l6_kes_he_2 (not _2b)', undefined, { once: true }),
  l6_kes_he_3: U('head-end sequence (stopped at its cut)', { once: true }),
  l6_aas_1: U('v6_handset (the call, twice at most)', { max: 2 }),
  l6_aas_2: U('the handset picked up'),
  l6_reyes_aas: U('the call'),
  l6_aas_3: U('the call (stopped at its cut: the line goes dead)'),
  l6_kes_aas: C((F) => F.heard('l6_aas_2'), 'heard l6_aas_2', undefined, { once: true }),
  l6_reyes_queue: C((F) => F.queueClosed, 'note6_queue read (closed)', undefined, { once: true }),
  l6_kes_queue: C((F) => F.heard('l6_reyes_queue'), 'after l6_reyes_queue', undefined, { once: true }),
  l6_unit_manual: U('the crank done'),
  l6_kes_manual: C((F) => F.manual && !F.bjOpen, 'manual, not yet in the enclosure', undefined, { once: true }),
  l6_kes_he_contact: C((F) => F.f4Spawned && !F.f4InView && !F.inVault && !F.heard('l6_kes_he_contact_b'), 'F4 spawned, none in view, player not in vault6', 'l6_kes_he_contact_b', { once: true }),
  l6_kes_he_contact_b: C((F) => F.f4Spawned && !F.f4InView && F.inVault && !F.heard('l6_kes_he_contact'), 'F4 spawned, none in view, player in vault6 (S11c)', undefined, { once: true }),
  // ── vault, shaft (§4.6, §4.7)
  l6_kes_vault: C((F) => F.inVault && !F.pulled && F.hostiles === 0, 'first t6_vault, calm, not pulled', undefined, { once: true }),
  l6_unit_deny_a: U('vault6_lock pressed without Key A', { cooldown: 10 }),
  l6_kes_bj: C((F) => F.bjOpen && !F.pulled, 'the enclosure open, not pulled', undefined, { once: true }),
  l6_unit_pull: U('the pull done'),
  l6_kes_pull_1: U('the pull sequence (after l6_unit_pull)', { once: true }),
  l6_kes_pull_2: C((F) => F.heard('l6_kes_pull_1') && !F.shaftOpen, 'after _pull_1, d6_shaft still locked', undefined, { once: true }),
  l6_kes_thud: C((F) => F.thudWithin(3), 'v6_thud fired ≤ 3 s ago', undefined, { once: true }),
  l6_unit_deny_b: U('shaft6_lock pressed without Key B', { cooldown: 10 }),
  l6_unit_shaft: U('Key B used'),
  l6_kes_shaft: C((F) => F.shaftLightsAgo >= 4 && F.shaftLightsAgo < 30, 'v6_shaft_lights fired 4.4 s ago', undefined, { once: true }),
  // ── moon pool (§4.8 — driven by boss.ts, ST-b)
  l6_kes_pool_1: C((F) => F.revealed, 'first t6_reveal', undefined, { once: true }),
  l6_kes_pool_2: C((F) => F.heard('l6_kes_pool_1') && F.loaderInView, 'after _pool_1, the loader in view', 'l6_kes_pool_2b', { once: true }),
  l6_kes_pool_2b: C((F) => F.heard('l6_kes_pool_1') && !F.loaderInView, 'after _pool_1, the loader not in view', undefined, { once: true }),
  l6_unit_loader_1: C((F) => F.hostile && (!F.heard('l6_unit_loader_1') || F.onDock), 'the hostile start; again: player on the dock (cooldown 25 s, ≤ 4 more)', undefined, { cooldown: 25, max: 5 }),
  l6_unit_loader_2: U('a SHIFT / DROP starts', { cooldown: 20 }),
  l6_unit_loader_3: U('the cowl opens'),
  l6_kes_boss_1: C((F) => F.stage >= 1 && heardAny(F, 'l6_choir_pool_stop', 'l6_choir_pool_command'), 'stage 1, after _choir_pool', undefined, { once: true }),
  l6_kes_boss_ram: C((F) => F.slamRecoveryInView && F.ramsGone === 0, 'a slam recovery in view, no ram destroyed yet', undefined, { once: true }),
  l6_kes_boss_flood: C((F) => F.floodLitFor >= 2 && F.floodAlive, 'flood-lit ≥ 2 s with an aware soldier, a flood alive', undefined, { once: true }),
  l6_kes_boss_frame: C((F) => F.inCage && F.soldierAlive, 'first feet in t6_cage with a soldier alive', undefined, { once: true }),
  l6_kes_pin: C((F) => F.pinOut, 'pin out', undefined, { once: true }),
  l6_kes_pump_half: C((F) => F.pressure >= 0.5, 'pressure ≥ 50 %', undefined, { once: true }),
  l6_kes_pump_done: C((F) => F.pressure >= 1 && !F.trunkCut, 'pressure full, not cut', undefined, { once: true }),
  l6_unit_shear_pin: U('pump or lever pressed before the pin', { cooldown: 6 }),
  l6_unit_shear_low: U('lever pressed before full pressure', { cooldown: 6 }),
  l6_kes_boss_pod: C((F) => F.ramsGone >= 2 && F.loaderAlive, 'both rams gone, pod alive', undefined, { once: true }),
  l6_kes_loader_dead: C((F) => F.loaderDead && !F.trunkCut, 'loader dead, not cut', undefined, { once: true }),
  l6_kes_dark: U('the cut + 1.2', { once: true }),
  l6_kes_cut_loader: C((F) => F.trunkCut && F.loaderAlive, 'cut, loader alive, after _dark', undefined, { once: true }),
  l6_kes_console: C((F) => F.quiet, 'l6_quiet + 3.0', undefined, { once: true }),
  l6_kes_console_2: C((F) => F.endingPending && F.hostiles === 0, 'ending pending, calm', undefined, { cooldown: 60 }),
  // ── the ending (E1 / E2, scene clock — scenes.ts, ST-b)
  l6_kes_end_1: C((F) => F.inEnding && !F.manifestRead, 'E1, the queue not read', 'l6_kes_end_1b', { once: true }),
  l6_kes_end_1b: C((F) => F.inEnding && F.manifestRead, 'E1, the queue read (fact manifest)', undefined, { once: true }),
  l6_sunde_end_1: U('E1', { once: true }), l6_sunde_end_2: U('E1', { once: true }), l6_reyes_end: U('E1', { once: true }),
  l6_kes_end_2: U('E1', { once: true }), l6_kes_end_3: U('E2 + 1.6', { once: true }),
  l6_kes_end_4: C((F) => F.inEnding && F.heard('l6_aas_2'), 'E2, heard l6_aas_2', 'l6_kes_end_4b', { once: true }),
  l6_kes_end_4b: C((F) => F.inEnding && !F.heard('l6_aas_2'), 'E2, l6_aas_2 not heard (S11a)', undefined, { once: true }),
  // ── Kessler on Q (§6.2)
  l6_kes_ack: U('Q pressed'),
  l6_kes_busy: C((F) => F.hostileWithin(25) && !F.inPoolShaft, 'Q, hostile awake within 25 m, not in pool6 / shaft6'),
  l6_kes_hint_he: C((F) => !F.manual && !F.inHeVault, 'Q, not in he6 / vault6, not manual'),
  l6_kes_hint_switch: C((F) => !F.manual && F.inHeVault, 'Q, in he6 / vault6 / trench, not manual'),
  l6_kes_hint_bj: C((F) => F.manual && !F.pulled, 'Q, manual, not pulled'),
  l6_kes_hint_shaft: C((F) => F.pulled && !F.shaftOpen, 'Q, pulled, the shaft locked'),
  l6_kes_hint_frame: C((F) => F.shaftOpen && !F.trunkCut, 'Q, phase K, not cut'),
  l6_kes_hint_loader: C((F) => F.trunkCut && F.loaderAlive, 'Q, cut, loader alive'),
  l6_kes_hint_console: C((F) => F.endingPending, 'Q, ending pending'),
};
// ── CHOIR (radio:1), by the stored choice
pair(RULES6, 'l6_choir_start', (F) => F.heard('l6_kes_start_2'), 'after l6_kes_start_2');
pair(RULES6, 'l6_choir_dark', (F) => F.f3Holding, 'g6_tunb_s holding + 1.0');
pair(RULES6, 'l6_choir_he', () => true, "at l6_kes_he_3's cut");
pair(RULES6, 'l6_choir_queue', (F) => F.heard('l6_kes_queue'), 'after l6_kes_queue');
pair(RULES6, 'l6_choir_manual', (F) => F.manual, 'after l6_kes_manual (or the crank + 1.0 if it was skipped)');
pair(RULES6, 'l6_choir_pull', (F) => F.pulled, 'after _pull_2 (or _pull_1)');
pair(RULES6, 'l6_choir_pool', (F) => F.hostile, 'the hostile start + 0.4');
pair(RULES6, 'l6_choir_pin', (F) => F.pinOut, 'pin out + 2.0, no Kessler line playing');
pair(RULES6, 'l6_choir_pump', (F) => F.heard('l6_kes_pump_half'), 'after _pump_half');
pair(RULES6, 'l6_choir_loader', (F) => F.loaderDead, 'loader dead + 0.6 (after any Kessler line)');
pair(RULES6, 'l6_choir_last', (F) => F.inEnding, 'E2 C1');
// ── soldiers (CHOIR through `throat`): the six 3c bark pairs reused by id, with 3c's bark gate (each ≤ 2 × per level)
pair(RULES6, 'l5_sol_down', (F) => barkOk(F), 'a soldier leaves hold / first sees the player, sight ≤ 15 m', { max: 2 });
pair(RULES6, 'l5_sol_need', (F) => barkOk(F) && !!F.bark?.hitRecently, 'the speaker was hit in the last 3 s, sight ≤ 15 m', { max: 2 });
pair(RULES6, 'l5_sol_felt', (F) => barkOk(F) && !!F.bark?.felt, 'another soldier died ≤ 4 s ago within 20 m of the speaker, sight', { max: 2 });
pair(RULES6, 'l5_sol_rounds', (F) => barkOk(F) && F.wastingRounds, 'player fired ≥ 15 rounds in 8 s with no hit, sight ≤ 15 m', { max: 2 });
pair(RULES6, 'l5_sol_light', (F) => barkOk(F, 25) && F.darkWithLight, 'player in regions.dark with the flashlight on, sight ≤ 25 m', { max: 2 });
// (§6.2's three new soldier pairs `l6_sol_frame` / `_reach` / `_lost`: a rule only when the line exists, so every rule
// keeps a manifest entry; the script's bark picker asks them — ST-b)
for (const [base, when, why] of [
  ['l6_sol_frame', (F: Facts6) => F.inCage && barkOk(F, 30), 'player in t6_cage, speaker has sight ≤ 30 m'],
  ['l6_sol_reach', (F: Facts6) => F.shaftOpen && !F.pinOut && !!F.bark && F.bark.sees && F.bark.dist >= 15, 'phase K, pin not out, sight at ≥ 15 m'],
  ['l6_sol_lost', (F: Facts6) => !!F.bark && !F.bark.sees && (F.bark.lostFor ?? 0) >= 3, 'the speaker lost sight ≥ 3 s with a last-known position'],
] as const) if (LINES6.has(`${base}_stop`)) pair(RULES6, base, when, why, { max: 2 });

export const L6_DIALOGUE: DialogueConfig<Facts6> = {
  rules: RULES6,
  line: line6,
  offStageFx: ['unit', 'recorder', 'pa', 'screen', 'choir', 'radio', 'radio:1', 'phone'],
};
