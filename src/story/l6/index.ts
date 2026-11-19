/**
 * STORY, level 6 — "간선" (stage 3d §4–§7, §8.10). The page flow (menu / gate → title card → lock6), the checkpoint
 * writer and resume are the shared scaffolding (../stage/page.ts); the script is ./script.ts (the route, ST-a) on
 * ./scenes.ts + ./boss.ts (the moon pool and the ending, ST-b) and ./base.ts; the lines' rules ./dialogue.ts; every
 * written text and the clock ./text.ts. This file adds the chapter end (§7.2, D3: carry `from: 6` with facts + `kills6`,
 * `manifest`, `aas`, `launchHour`, `trunkCut`, `loaderDead`, `testHour`; weapons; armour; the level-6 checkpoint cleared;
 * card `간선` / `` / `TO BE CONTINUED` 14 s skippable (`ending`), then `END OF CHAPTER 3` 4 s (`title`), then the
 * menu; stored level 6 while `LEVELS[6].next === null`) and the test hooks of the §10.0 contract.
 *
 * ═════════════════════════════════════════ TEST HOOKS on `window.__game.story` (§10.0; scripts/playthrough-l6.mjs H1–H19)
 *  H1 end() · H2 checkpoint(id) · H3 fire(name) (script.ts `fire`; unknown → null) · H4 hurry(fast?) · H5 lineLog
 *  ({ id, t, said, q, dur, end, cue }) · H6 rules ({ id: { kind, when, else?, once? } }, one per l6_ line + the reused
 *  l5_sol_ barks) · H7 debugState (script.ts) · H8 beats l6_* on `story:beat`, facts on `__game.facts` · H9 §6.4 texts ·
 *  H10 keypad(code) → false (no keypad in 3d) · H11 radioAsk() · H12 soldiers() (enemies.debug.soldiers) · H13
 *  worldState() · H14 audioLog() (audio.debug.log) · H15 boss() (enemies.debug.loader) · H16 grip(id, mode) · H17 wade()
 *  · H18 hitRate(k) (player.debug.hitRate) · H19 lockers() · next() → nextOf(6).
 */
import type { GameContext, StorySystem } from '../../core/types';
import { preload } from '../voice';
import { SPEC_L6, clearLevelSave, loadCarryFor, type CheckpointIdL6, type ProgressL6 } from '../save';
import { applyStartLoadout, carryOut, chainMode, finishLevel, goToLevel } from '../chain';
import { levelOf, nextOf } from '../../core/progress';
import { createStagePage } from '../stage/page';
import { ScriptL6 } from './script';
import { RULES6 } from './dialogue';
import { END_CARD_L6, END_CARD_L6_CHAPTER, END_CARD_L6_NEXT, LOG_IDS_L6, TITLE_CARD_L6, TOAST6 } from './text';

export { TITLE_CARD_L6, END_CARD_L6, END_CARD_L6_CHAPTER, END_CARD_L6_NEXT };

export async function createStoryL6(ctx: GameContext): Promise<StorySystem> {
  preload(ctx, ['l6_', 'l5_sol_']);
  const page = createStagePage<ProgressL6, CheckpointIdL6>(ctx, SPEC_L6, LOG_IDS_L6.length);
  const { stats, world } = page;
  let script: ScriptL6 | null = null;
  let ended = false;
  const cards: string[] = [];
  /** What the chain handed over at arrival (check-chain reads it). */
  const arrival = (() => {
    const c = loadCarryFor(6, ctx.debug);
    return { from: c?.from ?? null, armor: c ? c.armor : levelOf(ctx).direct.loadout?.armor ?? 0 };
  })();

  /** §7.2 / D3: the chapter end. Test runs (`?autostart=1`) store only with `&handoff=1` and stay on the last card. */
  async function end(): Promise<void> {
    if (ended) return;
    ended = true;
    const mode = chainMode(ctx);
    const next = nextOf(6, ctx.debug);
    const s = script;
    s?.markEnded();
    if (mode === 'off') clearLevelSave(6);
    else {
      try {
        const cf = s?.carryFacts();
        const hour = s?.clockHour() ?? 62.75;
        finishLevel(ctx, carryOut(ctx, {
          kills6: stats.kills, testHour: hour,
          manifest: cf?.manifest ?? false, aas: cf?.aas ?? false, launchHour: cf?.launchHour ?? hour,
          trunkCut: cf?.trunkCut ?? false, loaderDead: cf?.loaderDead ?? false,
        }));
      } catch (err) { console.error('[story] level-6 end not stored', err); clearLevelSave(6); }
    }
    if (!(s?.debugState.beats ?? []).includes('l6_end')) ctx.events.emit('story:beat', { id: 'l6_end' });
    try { ctx.input.exitPointerLock(); } catch { /* ignore */ }
    world.fade(1, 1.0);
    try { s?.talk.shutUp(); } catch { /* ignore */ }
    try { ctx.ui.radio(null); } catch { /* ignore */ }
    ctx.setState('ended');
    ctx.ui.setHudVisible(false);
    try {
      if (next === null) {
        cards.push(END_CARD_L6.join('|'));
        await ctx.ui.showCard(END_CARD_L6, { style: 'ending', skippable: true, seconds: 14 });
        cards.push(END_CARD_L6_CHAPTER.join('|'));
        await ctx.ui.showCard(END_CARD_L6_CHAPTER, { style: 'title', skippable: true, seconds: 4 });
      } else {
        cards.push(END_CARD_L6_NEXT.join('|'));
        await ctx.ui.showCard(END_CARD_L6_NEXT, { style: 'ending', skippable: true, seconds: 6 });
      }
    } catch (err) { console.error('[story] end card failed', err); }
    try { ctx.render.post.grade?.(0, 0); } catch { /* ignore */ }
    if (mode === 'reload') { if (next !== null) goToLevel(); else location.reload(); }
  }

  script = new ScriptL6(ctx, page.seq, page.director, world, page.logs, { ...page.hooks, end });
  script.cut = page.rig.cutscene;
  script.arrival = arrival;
  const s = script;

  const story = page.finish(s, {
    async begin(card: boolean) {
      s.loadout = applyStartLoadout(ctx);
      if (card) await ctx.ui.showCard(TITLE_CARD_L6, { style: 'title', skippable: true, seconds: 4.2 });
      s.start();
      s.begin();
      (ctx.ui as unknown as { blackout?: (on: boolean, sec?: number) => void }).blackout?.(false, 0.6);
      world.fade(0, card ? 1.6 : 0.8);
    },
    noStory: () => s.openEverything(),
    afterFastForward: () => { s.loadout = 'save'; },
    resumed: () => s.resumeLive(),
    restoredToast: TOAST6.restored,
  });
  const rules = Object.fromEntries(Object.entries(RULES6).map(([id, r]) => [id, {
    kind: r.when ? 'C' : 'U', when: r.when ? `C: ${r.why}` : `U: ${r.why}`, why: r.why,
    ...(r.else ? { else: r.else } : {}), ...(r.once ? { once: true } : {}), ...(r.max !== undefined ? { max: r.max } : {}), ...(r.cooldown !== undefined ? { cooldown: r.cooldown } : {}),
  }]));
  const audioLog = () => {
    const l = (ctx.audio as unknown as { debug?: { log?: unknown } }).debug?.log;
    if (Array.isArray(l)) return l.slice();
    if (typeof l === 'function') { try { const r = (l as () => unknown)(); return Array.isArray(r) ? r.slice() : []; } catch { return []; } }
    return [];
  };
  const dbg = <T>(get: () => T, fb: T): T => { try { return get(); } catch { return fb; } };
  Object.assign(story, {
    end,
    checkpoint: (id: CheckpointIdL6 = 'cp6_start') => s.debugCheckpoint(id),
    rules,
    next: () => nextOf(6, ctx.debug),
    keypad: () => false,
    radioAsk: () => s.radioAsk(),
    soldiers: () => dbg(() => (ctx.enemies as unknown as { debug?: { soldiers?: () => unknown[] } }).debug?.soldiers?.() ?? [], [] as unknown[]),
    worldState: () => s.worldState(),
    audioLog,
    boss: () => dbg(() => (ctx.enemies as unknown as { debug?: { loader?: (g?: string) => unknown } }).debug?.loader?.('g6_loader') ?? null, null as unknown),
    grip: (id: string, mode: 'done' | 'abandon' | number) => s.gripHook(String(id), mode),
    wade: () => s.wade(),
    hitRate: (k: number | null) => dbg(() => (ctx.player as unknown as { debug?: { hitRate?: (k: number | null) => unknown } }).debug?.hitRate?.(k) ?? null, null as unknown),
    lockers: () => s.lockers(),
    cards: () => cards.slice(),
  });
  return story;
}
