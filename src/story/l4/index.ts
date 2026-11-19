/**
 * STORY, level 4 — "생물 시스템" (stage 3b §4–§7, §8.10). The page flow (menu / gate → title card → the lock),
 * the checkpoint writer and resume are the shared scaffolding (../stage/page.ts); the script is ./script.ts (on
 * ./base.ts), the lines' rules ./dialogue.ts, every written text and the clock ./text.ts. This file adds the stage end
 * (§7: carry `from: 4` with facts + `kills4`, `testHour`, the first-view flags; weapons incl. the carbine; armour; the
 * level-4 checkpoint cleared; end card `생물 시스템` / `TO BE CONTINUED` 12 s skippable; the menu; stored level
 * stays 4 while `LEVELS[4].next === null`). Stage 3c §8.1 / D2: with a next (`nextOf(4) === 5` — the test override
 * `?next=4:5` until IA sets `LEVELS[4].next`) the card is `생물 시스템` alone, 6 s skippable, then `goToLevel()`.
 *
 * ═════════════════════════════════════════ TEST HOOKS on `window.__game.story` (scripts/playthrough-l4.mjs H1–H9)
 *  H1 end()                 the stage end of §7 (as the natural end calls it).
 *  H2 checkpoint(id)        write checkpoint `id` now from the current record (debug; default cp4_start).
 *  H3 fire(name)            run a beat / force a gate as if its trigger happened; truthy = done, null = refused/unknown:
 *                           'override' (cold_ack, phase C) · 'lights_out' · 'armed' (F5) · 'equalise' (the valve) ·
 *                           'equalised' (end the 25 s clock now) · 'refuse' · 'release' (equalises first if needed) ·
 *                           'tube_fight' (F6 now) · 'gate_open' · 'gatelock' (latch without the keep-side test) ·
 *                           'decon' (end the decon count) · 'shower' (latch without the trigger) · 'video' (press the
 *                           log) · any level vignette id (fired as is, stamped `vignette:<id>`).
 *  H4 hurry(fast?)          shorten `wait`s / lines (tests only; fixed clocks — decon, shower, equalising — untouched).
 *  H5 lineLog               the dialogue channel's log (`t` start, `q` asked, `said`, `cond`) + `dur`, `end` for every
 *                           line spoken and `cue` (script clock) for every timed line (§8.12: |t − cue| ≤ 0.12).
 *  H6 rules                 { [l4_ id]: { kind: 'U' | 'C', why, else? } } — the RULES table, read-only.
 *  H7 debugState            level, now, beats, t (first time of: every beat, `phase:<id>`, `vignette:<id>`, named
 *                           instants override/suite/lights_out/bay_closed/armed/equalise/tube_fight/gate_open/sealed/
 *                           dogs/end, checkpoint ids), phase, phaseApplied, flags (§7 names + the rest), checkpoints,
 *                           checkpoint, pendingCheckpoint, restoredFrom, calm, blocked, heard, missingMarkers, failHold,
 *                           loadout, arrival, ended, objective, arm { cue, t, n, period, attempt, led, log }, video log
 *                           state, times { decon, shower, equalise }, cues (timed-line log), spawns (R4 evidence),
 *                           views, facts (first-view flags), testHour, arrivalHour.
 *  H8 beats (story:beat + debugState.beats): l4_start, l4_decon_done, l4_shower, l4_clean, l4_override, l4_lights_out
 *                           (again on a load past it), l4_theatre, l4_armed, l4_equalise, l4_tube_fight, l4_gatelock,
 *                           l4_end. Facts on `__game.facts` when earned: l4_theatre, l4_video, l4_roster, l4_equalised.
 *  H9 objectives / toasts   the exact §6.4 texts (text.ts OBJ4 / TOAST4).
 *  also: next() → nextOf(4) (null on main).
 */
import type { GameContext, StorySystem } from '../../core/types';
import { preload } from '../voice';
import { SPEC_L4, clearLevelSave, loadCarryFor, type CheckpointIdL4, type ProgressL4 } from '../save';
import { applyStartLoadout, carryOut, chainMode, finishLevel, goToLevel } from '../chain';
import { levelOf, nextOf } from '../../core/progress';
import { createStagePage } from '../stage/page';
import { ScriptL4 } from './script';
import { RULES4 } from './dialogue';
import { END_CARD_L4, END_CARD_L4_NEXT, LOG_IDS_L4, TITLE_CARD_L4, TOAST4 } from './text';

export { TITLE_CARD_L4, END_CARD_L4 };

export async function createStoryL4(ctx: GameContext): Promise<StorySystem> {
  preload(ctx, ['l4_']);
  const page = createStagePage<ProgressL4, CheckpointIdL4>(ctx, SPEC_L4, LOG_IDS_L4.length);
  const { stats, world } = page;
  let script: ScriptL4 | null = null;
  let ended = false;
  /** What the chain handed over at arrival (check-chain reads it). */
  const arrival = (() => {
    const c = loadCarryFor(4, ctx.debug);
    return { from: c?.from ?? null, armor: c ? c.armor : levelOf(ctx).direct.loadout?.armor ?? 0 };
  })();

  async function end(): Promise<void> {
    if (ended) return;
    ended = true;
    const mode = chainMode(ctx);
    const next = nextOf(4, ctx.debug);
    const s = script;
    s?.markEnded();
    if (mode === 'off') clearLevelSave(4);
    else {
      try { finishLevel(ctx, carryOut(ctx, { kills4: stats.kills, testHour: s?.clockHour() ?? 62 + 10 / 60, ...(s?.firstViews() ?? {}) })); }
      catch (err) { console.error('[story] level-4 end not stored', err); clearLevelSave(4); }
    }
    if (!(s?.debugState.beats ?? []).includes('l4_end')) ctx.events.emit('story:beat', { id: 'l4_end' });
    try { ctx.input.exitPointerLock(); } catch { /* ignore */ }
    world.fade(1, 1.0);
    try { s?.talk.shutUp(); } catch { /* ignore */ }
    ctx.setState('ended');
    ctx.ui.setHudVisible(false);
    const card = next === null ? END_CARD_L4 : END_CARD_L4_NEXT;
    try { await ctx.ui.showCard(card, { style: 'ending', skippable: true, seconds: next === null ? 12 : 6 }); } catch (err) { console.error('[story] end card failed', err); }
    try { ctx.render.post.grade?.(0, 0); } catch { /* ignore */ }
    if (mode === 'reload') { if (next !== null) goToLevel(); else location.reload(); }
  }

  script = new ScriptL4(ctx, page.seq, page.director, world, page.logs, { ...page.hooks, end });
  script.arrival = arrival;
  const s = script;

  const story = page.finish(s, {
    async begin(card: boolean, short: boolean) {
      s.loadout = applyStartLoadout(ctx);
      if (card) await ctx.ui.showCard(TITLE_CARD_L4, { style: 'title', skippable: true, seconds: 4.2 });
      s.start();
      s.begin(short);
      (ctx.ui as unknown as { blackout?: (on: boolean, sec?: number) => void }).blackout?.(false, 0.6);
      world.fade(0, short ? 0.3 : 1.6);
    },
    noStory: () => s.openEverything(),
    afterFastForward: () => { s.loadout = 'save'; },
    resumed: () => s.resumeLive(),
    restoredToast: TOAST4.restored,
  });
  const rules = Object.fromEntries(Object.entries(RULES4).map(([id, r]) => [id, { kind: r.when ? 'C' : 'U', why: r.why, ...(r.else ? { else: r.else } : {}) }]));
  Object.assign(story, {
    end,
    checkpoint: (id: CheckpointIdL4 = 'cp4_start') => s.debugCheckpoint(id),
    rules,
    next: () => nextOf(4, ctx.debug),
  });
  return story;
}
