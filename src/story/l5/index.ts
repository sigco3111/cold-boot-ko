/**
 * STORY, level 5 — "초소 4" (stage 3c §4–§7, §8.10). The page flow (menu / gate → title card → the gate lock), the
 * checkpoint writer and resume are the shared scaffolding (../stage/page.ts); the script is ./script.ts (on
 * ./scenes.ts, ./base.ts), the lines' rules ./dialogue.ts, every written text and the clock ./text.ts. This file adds
 * the stage end (§7: carry `from: 5` with facts + `kills5`, `radio`, `kessler`, `l5_door`, `l5_boat`, `testHour`;
 * weapons incl. the carbine; armour; the level-5 checkpoint cleared; end card `초소 4` / `TO BE CONTINUED` 12 s
 * skippable; the menu; stored level 5 while `LEVELS[5].next === null` — with a next, `초소 4` alone 6 s and the
 * hand-over) and the test hooks of the §10.0 contract.
 *
 * ═════════════════════════════════════════ TEST HOOKS on `window.__game.story` (§10.0; scripts/playthrough-l5.mjs H1–H14)
 *  H1 end() · H2 checkpoint(id) · H3 fire(name) (script.ts `fire`; unknown → null) · H4 hurry(fast?) · H5 lineLog
 *  ({ id, t, said, q, dur, end, cue }) · H6 rules ({ id: { kind, when, else?, once? } }, one per l5_ line) ·
 *  H7 debugState (script.ts) · H8 beats l5_start … l5_end on `story:beat`, facts on `__game.facts` · H9 §6.4 texts ·
 *  H10 keypad(code) · H11 radioAsk() · H12 soldiers() (enemies.debug.soldiers) · H13 worldState() · H14 audioLog()
 *  (audio.debug.log) · next() → nextOf(5).
 */
import type { GameContext, StorySystem } from '../../core/types';
import { preload } from '../voice';
import { SPEC_L5, clearLevelSave, loadCarryFor, type CheckpointIdL5, type ProgressL5 } from '../save';
import { applyStartLoadout, carryOut, chainMode, finishLevel, goToLevel } from '../chain';
import { levelOf, nextOf } from '../../core/progress';
import { createStagePage } from '../stage/page';
import { ScriptL5 } from './script';
import { RULES5 } from './dialogue';
import { END_CARD_L5, END_CARD_L5_NEXT, LOG_IDS_L5, TITLE_CARD_L5, TOAST5 } from './text';

export { TITLE_CARD_L5, END_CARD_L5, END_CARD_L5_NEXT };

export async function createStoryL5(ctx: GameContext): Promise<StorySystem> {
  preload(ctx, ['l5_']);
  const page = createStagePage<ProgressL5, CheckpointIdL5>(ctx, SPEC_L5, LOG_IDS_L5.length);
  const { stats, world } = page;
  let script: ScriptL5 | null = null;
  let ended = false;
  /** What the chain handed over at arrival (check-chain reads it). */
  const arrival = (() => {
    const c = loadCarryFor(5, ctx.debug);
    return { from: c?.from ?? null, armor: c ? c.armor : levelOf(ctx).direct.loadout?.armor ?? 0 };
  })();

  /** §7 / D3: the stage end. Test runs (`?autostart=1`) store only with `&handoff=1` and stay on the card. */
  async function end(): Promise<void> {
    if (ended) return;
    ended = true;
    const mode = chainMode(ctx);
    const next = nextOf(5, ctx.debug);
    const s = script;
    s?.markEnded();
    if (mode === 'off') clearLevelSave(5);
    else {
      try {
        const F = ctx.facts as Record<string, unknown>;
        finishLevel(ctx, carryOut(ctx, {
          kills5: stats.kills, testHour: s?.clockHour() ?? 62.5,
          radio: F.radio === true, kessler: F.radio === true, l5_door: F.l5_door === true, l5_boat: F.l5_boat === true,
        }));
      } catch (err) { console.error('[story] level-5 end not stored', err); clearLevelSave(5); }
    }
    if (!(s?.debugState.beats ?? []).includes('l5_end')) ctx.events.emit('story:beat', { id: 'l5_end' });
    try { ctx.input.exitPointerLock(); } catch { /* ignore */ }
    world.fade(1, 1.0);
    try { s?.talk.shutUp(); } catch { /* ignore */ }
    try { ctx.ui.radio(null); } catch { /* ignore */ }
    ctx.setState('ended');
    ctx.ui.setHudVisible(false);
    const card = next === null ? END_CARD_L5 : END_CARD_L5_NEXT;
    try { await ctx.ui.showCard(card, { style: 'ending', skippable: true, seconds: next === null ? 12 : 6 }); } catch (err) { console.error('[story] end card failed', err); }
    try { ctx.render.post.grade?.(0, 0); } catch { /* ignore */ }
    if (mode === 'reload') { if (next !== null) goToLevel(); else location.reload(); }
  }

  script = new ScriptL5(ctx, page.seq, page.director, world, page.logs, { ...page.hooks, end });
  script.cut = page.rig.cutscene;
  script.arrival = arrival;
  const s = script;

  const story = page.finish(s, {
    async begin(card: boolean) {
      s.loadout = applyStartLoadout(ctx);
      if (card) await ctx.ui.showCard(TITLE_CARD_L5, { style: 'title', skippable: true, seconds: 4.2 });
      s.start();
      s.begin();
      (ctx.ui as unknown as { blackout?: (on: boolean, sec?: number) => void }).blackout?.(false, 0.6);
      world.fade(0, card ? 1.6 : 0.3);
    },
    noStory: () => s.openEverything(),
    afterFastForward: () => { s.loadout = 'save'; },
    resumed: () => s.resumeLive(),
    restoredToast: TOAST5.restored,
  });
  const rules = Object.fromEntries(Object.entries(RULES5).map(([id, r]) => [id, {
    kind: r.when ? 'C' : 'U', when: r.when ? `C: ${r.why}` : `U: ${r.why}`, why: r.why,
    ...(r.else ? { else: r.else } : {}), ...(r.once ? { once: true } : {}), ...(r.max !== undefined ? { max: r.max } : {}), ...(r.cooldown !== undefined ? { cooldown: r.cooldown } : {}),
  }]));
  const audioLog = () => {
    const l = (ctx.audio as unknown as { debug?: { log?: unknown } }).debug?.log;
    if (Array.isArray(l)) return l.slice();
    if (typeof l === 'function') { try { const r = (l as () => unknown)(); return Array.isArray(r) ? r.slice() : []; } catch { return []; } }
    return [];
  };
  Object.assign(story, {
    end,
    checkpoint: (id: CheckpointIdL5 = 'cp5_start') => s.debugCheckpoint(id),
    rules,
    next: () => nextOf(5, ctx.debug),
    keypad: (code: string) => s.keypad(String(code)),
    radioAsk: () => s.radioAsk(),
    soldiers: () => {
      try { const d = (ctx.enemies as unknown as { debug?: { soldiers?: () => unknown[] } }).debug; return d?.soldiers?.() ?? []; } catch { return []; }
    },
    worldState: () => s.worldState(),
    audioLog,
  });
  return story;
}
