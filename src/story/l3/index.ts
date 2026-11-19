/**
 * STORY, level 3 — "고요한 쪽" (stage 3a). The page-level flow (menu / one-click gate → title card → the lift),
 * the checkpoint writer and resume are the shared scaffolding (../stage/page.ts); the script is ./script.ts (on
 * ./scenes.ts, ./base.ts). This file adds the level end (D19: the carry for 3b + the end card `고요한 쪽` /
 * `TO BE CONTINUED` + the menu; stage 3b D4/D5: with a next level — `nextOf(3)`, `?next=3:4` in tests — the card
 * without "TO BE CONTINUED" and the hand-over).
 * Test hooks on `__game.story`: `end()`, `checkpoint(id)`, `fire(name)`, `hurry(fast?)`, `debugState`, `lineLog`,
 * `takeoverPreview()` (review frames).
 */
import type { GameContext, StorySystem } from '../../core/types';
import { preload } from '../voice';
import { SPEC_L3, clearLevelSave, type CheckpointIdL3, type ProgressL3 } from '../save';
import { applyStartLoadout, carryOut, chainMode, finishLevel, goToLevel } from '../chain';
import { nextOf } from '../../core/progress';
import { createStagePage } from '../stage/page';
import { ScriptL3 } from './script';
import { END_CARD_L3, END_CARD_L3_NEXT, LOG_IDS_L3, TITLE_CARD_L3, TOAST3 } from './text';

export async function createStoryL3(ctx: GameContext): Promise<StorySystem> {
  preload(ctx, ['l3_']);
  const page = createStagePage<ProgressL3, CheckpointIdL3>(ctx, SPEC_L3, LOG_IDS_L3.length);
  const { stats, world } = page;
  let script: ScriptL3 | null = null;
  let ended = false;

  /**
   * D19: the stage end. The carry for 3b (`from: 3`, facts + `badge`, `halvorsenAlive`, `kills3`, `testHour`) is
   * written, the level-3 checkpoint cleared. No next level (`nextOf(3) === null`, main until I1): the stored level
   * stays 3, the end card with "TO BE CONTINUED", then the menu. Next level 4 (3b D5): it becomes the stored level, the
   * card `고요한 쪽` alone (6 s, skippable), then the hand-over reload. Test runs (`?autostart=1`) store only
   * with `&handoff=1` and stay on the card.
   */
  async function end(): Promise<void> {
    if (ended) return;
    ended = true;
    const mode = chainMode(ctx);
    const next = nextOf(3, ctx.debug);
    if (mode === 'off') clearLevelSave(3);
    else {
      try { finishLevel(ctx, carryOut(ctx, { badge: true, halvorsenAlive: true, kills3: stats.kills, testHour: script?.clockHour() ?? 62 })); }
      catch (err) { console.error('[story] level-3 end not stored', err); clearLevelSave(3); }
    }
    if (!(script?.debugState.beats ?? []).includes('l3_end')) ctx.events.emit('story:beat', { id: 'l3_end' });
    try { ctx.input.exitPointerLock(); } catch { /* ignore */ }
    world.fade(1, 1.0);
    try { script?.talk.shutUp(); } catch { /* ignore */ }
    ctx.setState('ended');
    ctx.ui.setHudVisible(false);
    const card = next === null ? END_CARD_L3 : END_CARD_L3_NEXT;
    try { await ctx.ui.showCard(card, { style: 'ending', skippable: true, seconds: next === null ? 12 : 6 }); } catch (err) { console.error('[story] end card failed', err); }
    // the post chain persists across levels: back to today's grade
    try { ctx.render.post.grade?.(0, 0); } catch { /* ignore */ }
    if (mode === 'reload') { if (next !== null) goToLevel(); else location.reload(); }
  }

  script = new ScriptL3(ctx, page.seq, page.director, world, page.logs, { ...page.hooks, end });
  script.cut = page.rig.cutscene;
  const s = script;

  const story = page.finish(s, {
    async begin(card: boolean, short: boolean) {
      s.loadout = applyStartLoadout(ctx);
      if (card) await ctx.ui.showCard(TITLE_CARD_L3, { style: 'title', skippable: true, seconds: 4.2 });
      s.start();
      s.begin(short);
      (ctx.ui as unknown as { blackout?: (on: boolean, sec?: number) => void }).blackout?.(false, 0.6);
      world.fade(0, short ? 0.3 : 1.6);
    },
    noStory: () => s.openEverything(),
    afterFastForward: () => { s.loadout = 'save'; },
    resumed: () => s.resumeLive(),
    restoredToast: TOAST3.restored,
  });
  Object.assign(story, {
    end,
    checkpoint: (id: CheckpointIdL3 = 'cp3_start') => s.debugCheckpoint(id),
    /** Review only (frames of the takeover from anywhere): the warm → cold switch, without beats or doors. */
    takeoverPreview: () => s.debugTakeover(),
    /** Stage 3b (tests): the level this end hands over to — `nextOf(3)` incl. the `?next=` override; null = end card + menu. */
    next: () => nextOf(3, ctx.debug),
  });
  return story;
}
