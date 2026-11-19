/**
 * The level chain (REVISION 4; stage 3a §8.1). One level per page load: finishing a level stores the next one and
 * reloads. `LEVELS` is the only place that knows per-level facts — modules look them up with `levelOf(ctx)`
 * instead of comparing level numbers (`npm run check:chain` greps for such branches).
 * Adding a level: set the previous level's `next`, set `built: true`, add one entry to the dispatch maps in
 * `level/index.ts`, `story/index.ts` and `story/camera.ts` (menu shots). The chain reads `next` only through `nextOf()`.
 * Owned by the coordinator. Every storage access is guarded (private mode / disabled storage).
 */
import type { DebugFlags, DirectLoadout, LevelId, LevelInfo } from './types';

export const LEVEL_KEY = 'coldboot.level';

/** Where a new game starts (BEGIN). */
export const FIRST_LEVEL: LevelId = 1;
export const LEVEL_IDS: readonly LevelId[] = [1, 2, 3, 4, 5, 6];

/** §7: a direct start without a carry (levels 2, 3 and 4). */
const DIRECT: DirectLoadout = { weapons: { pistol: { clip: 12, reserve: 24 }, shotgun: { clip: 6, reserve: 8 } }, health: 100, flashlight: false };
const NO_CAST = { foreman: false, human: false, tomasHead: false, soldier: false };

/** The entry of a level id that has no implementation yet (none since stage 3d's K: 1 … 6 are all built). */
export const unbuilt = (id: LevelId): LevelInfo => ({
  id, tag: `l${id}`, built: false, title: `레벨 ${id}`, place: `레벨 ${id}`, bootStatus: `레벨 ${id}`,
  screenHeader: '할시온 다이내믹스 // 에리두 심해', camLabel: `L${id}`, idleText: true, powerOnAtLoad: true,
  keycardName: null, endEyebrow: null, menuLine: null, subtitles: 'stacked', cast: NO_CAST,
  direct: { facts: {}, loadout: DIRECT }, healthFloor: 50, next: null,
});

export const LEVELS: Readonly<Record<LevelId, LevelInfo>> = {
  1: {
    id: 1, tag: 'l1', built: true, title: 'COLD BOOT', place: '하부 3층', bootStatus: '하부 3층',
    screenHeader: '할시온 다이내믹스 // 에리두 심해 제작  —  하부 3층', camLabel: '하부-3', idleText: false, powerOnAtLoad: false,
    keycardName: null, endEyebrow: null, menuLine: null, subtitles: 'single', cast: NO_CAST,
    direct: { facts: {}, loadout: null }, healthFloor: 0, next: 2,
  },
  2: {
    id: 2, tag: 'l2', built: true, title: '2번 라인', place: '2번 라인', bootStatus: '2번 라인',
    screenHeader: '할시온 다이내믹스 // 에리두 심해 제작  —  2번 라인 / 구역 C', camLabel: '라인-2', idleText: true, powerOnAtLoad: true,
    keycardName: '구역 출입증', endEyebrow: '2번 라인 끝', menuLine: '레벨 2  —  2번 라인', subtitles: 'stacked',
    cast: { foreman: true, human: true, tomasHead: true, soldier: false },
    direct: { facts: {}, loadout: DIRECT }, healthFloor: 40, next: 3,
  },
  3: {
    id: 3, tag: 'l3', built: true, title: '고요한 쪽', place: '주거 링 A', bootStatus: '주거 링',
    screenHeader: '할시온 다이내믹스 // 에리두 심해 — 주거 링 A', camLabel: 'CAM', idleText: true, powerOnAtLoad: true,
    keycardName: '시설팀 배지', endEyebrow: '고요한 쪽 끝', menuLine: '3장  —  고요한 쪽', subtitles: 'stacked',
    cast: { foreman: false, human: true, tomasHead: false, soldier: false },
    direct: { facts: { choice: 'stop', unitsLeft: 28 }, loadout: { ...DIRECT, flashlight: true } }, healthFloor: 50,
    // stage 3b D4 (integration): finishing 3a hands over to level 4 (Biological Systems).
    next: 4,
  },
  4: {
    id: 4, tag: 'l4', built: true, title: '생물 시스템', place: '생물 시스템', bootStatus: '생물 시스템',
    screenHeader: '할시온 바이오 시스템즈 사업부 // 에리두 심해 — 생물', camLabel: 'BIO', idleText: true, powerOnAtLoad: true,
    keycardName: '시설팀 배지', endEyebrow: '생물 시스템 끝', menuLine: '3장  —  생물 시스템', subtitles: 'stacked',
    cast: NO_CAST,
    direct: { facts: { choice: 'stop', unitsLeft: 28, badge: true, halvorsenAlive: true }, loadout: { ...DIRECT, flashlight: true, armor: 0 } },
    // stage 3c: finishing level 4 hands over to level 5 (Post 4)
    healthFloor: 50, next: 5,
  },
  5: {
    id: 5, tag: 'l5', built: true, title: '초소 4', place: '4번 초소', bootStatus: '4번 초소',
    screenHeader: '해군 파견대 // 에리두 심해 — 초소 4', camLabel: '초소4', idleText: true, powerOnAtLoad: true,
    keycardName: '시설팀 배지', endEyebrow: '4번 초소 끝', menuLine: '3장  —  4번 초소', subtitles: 'stacked',
    // the cutscene soldier is an actor: his template is pre-warmed (§8.2.6)
    cast: { ...NO_CAST, soldier: true },
    direct: {
      facts: { choice: 'stop', unitsLeft: 28, badge: true, halvorsenAlive: true, testHour: 62.5 },
      loadout: { weapons: { pistol: { clip: 12, reserve: 24 }, shotgun: { clip: 6, reserve: 6 }, carbine: { clip: 30, reserve: 90 } }, health: 100, flashlight: true, armor: 50 },
    },
    // stage 3d: finishing level 5 hands over to level 6 (The Trunk)
    healthFloor: 50, next: 6,
  },
  6: {
    id: 6, tag: 'l6', built: true, title: '간선', place: '간선', bootStatus: '간선',
    screenHeader: '해군 파견대 // 에리두 심해 — 트렁크 헤드엔드', camLabel: 'DOCK', idleText: true, powerOnAtLoad: true,
    keycardName: '인터록 키', endEyebrow: '3장 끝', menuLine: '3장  —  간선', subtitles: 'stacked',
    // S8b: no soldier actor (the taken soldiers are spawns; the template is pre-warmed from `enemySpawns`)
    cast: NO_CAST,
    direct: {
      facts: { choice: 'stop', unitsLeft: 28, badge: true, halvorsenAlive: true, radio: true, kessler: true, l5_door: true, l5_boat: false, kills5: 0, testHour: 62.75 },
      // lands as 12 / 36, 6 / 12, 30 / 120 through the pickup path (3c K note)
      loadout: { weapons: { pistol: { clip: 12, reserve: 24 }, shotgun: { clip: 6, reserve: 6 }, carbine: { clip: 30, reserve: 90 } }, health: 100, flashlight: true, armor: 50 },
    },
    // stage 3d D3: the chapter ends here (end card, END OF CHAPTER 3, menu)
    healthFloor: 50, next: null,
    // the loader's PA is a horn in the chamber (positional `pa` lines → `pa_dock`)
    paDock: true,
  },
};

export function isLevelId(n: unknown): n is LevelId {
  return typeof n === 'number' && (LEVEL_IDS as readonly number[]).includes(n);
}

/**
 * The info of a level. `undefined` (a dev page that sets no level) is level 1 — the explicit default; any other
 * value that is not a level id throws, so a missing table entry fails loudly instead of silently becoming level 1.
 */
export function levelInfo(id: LevelId | number | undefined | null): LevelInfo {
  if (id === undefined || id === null) return LEVELS[FIRST_LEVEL];
  if (!isLevelId(id)) throw new Error(`[progress] unknown level ${String(id)}`);
  return LEVELS[id];
}

/** The info of the level this page load runs. */
export function levelOf(ctx: { levelId?: LevelId }): LevelInfo {
  return levelInfo(ctx.levelId);
}

/**
 * Stage 3b §8.1: the level the chain hands over to after `id` — the test override `debug.next[id]` (`?next=3:4`) when
 * given, else `LEVELS[id].next`. Every reader of the chain (finishLevel, the carry check, level ends) goes through it.
 */
export function nextOf(id: LevelId, debug?: Pick<DebugFlags, 'next'> | null): LevelId | null {
  const o = debug?.next?.[id];
  return o !== undefined && isLevelId(o) ? o : LEVELS[id].next;
}

/** The highest built level ≤ `id` (every id 1 … 6 is built since stage 3d's K; `?level=7`+ is capped to 6 by `parseLevel`). */
export function clampBuilt(id: number): LevelId {
  let best: LevelId = FIRST_LEVEL;
  for (const l of LEVEL_IDS) if (LEVELS[l].built && l <= id) best = l;
  return best;
}

/** `?level=` / stored value → a level id: integers ≥ 1 (above 6 → 6); anything else null. Not clamped to built. */
export function parseLevel(raw: string | null | undefined): LevelId | null {
  if (raw === null || raw === undefined || !/^\s*\d+\s*$/.test(raw)) return null;
  const n = Number(raw);
  if (n < 1) return null;
  return Math.min(n, LEVEL_IDS[LEVEL_IDS.length - 1]) as LevelId;
}

export function storedLevel(): LevelId {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LEVEL_KEY); } catch { return FIRST_LEVEL; }
  const n = parseLevel(raw);
  return n === null ? FIRST_LEVEL : clampBuilt(n);
}

export function setStoredLevel(level: LevelId): void {
  try { localStorage.setItem(LEVEL_KEY, String(level)); } catch { /* ignore */ }
}

/** `?level=` wins; `?nostory=1`/tests without it get the stored level. Always a built level. */
export function resolveLevel(debug: DebugFlags): LevelId {
  return clampBuilt(debug.level ?? storedLevel());
}
