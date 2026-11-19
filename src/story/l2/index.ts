/**
 * STORY, level 2 — "2번 라인" (REVISION 4). Owns the flow of this page load: menu / one-click gate →
 * title card → the lift arrives → the script (./script.ts) → one of two endings. The page-level flow, the
 * checkpoint writer and resume are the shared scaffolding (../stage/page.ts); this file adds the arrival, the
 * ending and the hand-over to level 3.
 */
import type { GameContext, StorySystem } from '../../core/types';
import { preload } from '../voice';
import { CHECKPOINT_IDS_L2, STORY_REV_L2, clearSaveL2, type CheckpointIdL2, type ProgressL2, type SaveSpec } from '../save';
import { levelOf, setStoredLevel } from '../../core/progress';
import { applyStartLoadout, carryOut, chainMode, finishLevel, goToLevel } from '../chain';
import { createStagePage } from '../stage/page';
import { ScriptL2 } from './script';
import { END_CARDS, ENDING_L2, LOG_IDS_L2, TITLE_CARD_L2, TOAST2 } from './text';

/** Same spec as save.ts's level-2 entry (`loadSaveL2`): existing saves load unchanged. */
const SPEC_L2: SaveSpec = { level: 2, rev: STORY_REV_L2, ids: CHECKPOINT_IDS_L2 };

export async function createStoryL2(ctx: GameContext): Promise<StorySystem> {
  preload(ctx, ['l2_']);
  const page = createStagePage<ProgressL2, CheckpointIdL2>(ctx, SPEC_L2, LOG_IDS_L2.length);
  const { stats, logs, world } = page;

  const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  /**
   * Both endings: one card (`ui.showCard`, style 'ending') — what was done, what Unit 14 got, the stats (D20: no
   * "TO BE CONTINUED" while the chain goes on). §8.1: the carry with the facts (`choice`, `unitsLeft`) is written
   * BEFORE the checkpoint is cleared, level 3 becomes the stored level, and after the card the page hands over
   * to it (one click). Test runs (`?autostart=1`) store nothing unless `&handoff=1` and never reload; without it
   * the stored level stays 2, as before.
   */
  async function ending(choice: 'shutdown' | 'rewrite', unit14: 'spared' | 'shot' | 'killed', left: number): Promise<void> {
    const mode = chainMode(ctx);
    let next: ReturnType<typeof finishLevel> = null;
    if (mode === 'off') { clearSaveL2(); setStoredLevel(2); }
    else {
      try { next = finishLevel(ctx, carryOut(ctx, { choice: choice === 'shutdown' ? 'stop' : 'command', unitsLeft: left })); }
      catch (err) { console.error('[story] hand-over not stored', err); clearSaveL2(); }
    }
    const e = ENDING_L2[choice];
    try { ctx.input.exitPointerLock(); } catch { /* ignore */ }
    const lines = [
      e.eyebrow, '',
      ...END_CARDS[choice](left), END_CARDS.unit14[unit14], '',
      e.status(left),
      `시간: ${fmtTime(stats.time)}`, `정지시킨 기계: ${stats.kills}`, `RECORDS RECOVERED: ${logs.size} / ${LOG_IDS_L2.length}`,
      ...(levelOf(ctx).next === null ? ['', ENDING_L2.tbc] : []),
    ];
    try {
      await ctx.ui.showCard(lines, { style: 'ending', skippable: true, seconds: 34 });
    } catch (err) { console.error('[story] ending card failed', err); }
    if (mode !== 'reload') return;
    if (next !== null) goToLevel(); else location.reload();
  }

  const script = new ScriptL2(ctx, page.seq, page.director, world, logs, { ...page.hooks, ending });

  const story = page.finish(script, {
    /** A new run of this level: loadout (the carry from level 1, else the direct-start loadout), title card, the lift arrives. */
    async begin(card: boolean, short: boolean) {
      applyStartLoadout(ctx);
      if (card) await ctx.ui.showCard(TITLE_CARD_L2, { style: 'title', skippable: true, seconds: 4.2 });
      script.start();
      await script.arrival(short);
    },
    noStory: () => script.openEverything(),
    afterFastForward(save) {
      if (!save.story.flags.power) return;
      try { ctx.audio.setMuffle(1); } catch { /* ignore */ }
      ctx.events.emit('story:beat', { id: 'l2_power' });
      setTimeout(() => { try { if (ctx.state !== 'paused') ctx.audio.setMuffle(0); } catch { /* ignore */ } }, 2600);
    },
    resumed: () => script.resumeLive(),
    restoredToast: TOAST2.restored,
  });
  // `ending` (check:chain): run the level end directly — the card and the §8.1 hand-over — without playing the level.
  Object.assign(story, { ending });
  return story;
}
