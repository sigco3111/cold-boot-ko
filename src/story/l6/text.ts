/**
 * Level 6 "THE TRUNK" — every piece of written text (stage 3d §6.3–§6.4) and the ONE clock (`CLOCK6`).
 * Spoken lines live in `voice/lines.l6.json` (read-only here). Readables ≤ 30 words, each stands alone (R3).
 */
import type { Fragment } from '../text';

export const TITLE_CARD_L6 = ['간선', '에리두 심해 기지 — 해군 분견대'];
/** §7.2 / D3: the chapter-end card (`style: 'ending'`, 14 s, skippable), then `END_CARD_L6_CHAPTER` (4 s, `title`). */
export const END_CARD_L6 = ['간선', '', '계속'];
export const END_CARD_L6_CHAPTER = ['3장 끝'];
/** The end card when the chain has a next level (never on main: `LEVELS[6].next` is null; a test `?next=6:N`). */
export const END_CARD_L6_NEXT = ['간선'];

// ───────────────────────────────────────────────────────────── the clock (§6.4 CLOCK6)

/** The test hour at arrival when no carry brings one (62:45 = WED 23:25). */
export const ARRIVAL_DEFAULT6 = 62.75;
/** Test hour 0 = MON 08:40 (the link drill; level 3's `CLOCK.testStart`) — the same derivation as 3b / 3c. */
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
/** Wall clock `WED 23:25` of a test hour. */
export function wallClock6(hour: number): string {
  const min = Math.floor((8 * 60 + 40) + hour * 60);
  const day = DAYS[Math.floor(min / 1440) % 7];
  const m = ((min % 1440) + 1440) % 1440;
  return `${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** `hh:mm` only. */
export const hhmm6 = (hour: number) => wallClock6(hour).slice(2);

// ───────────────────────────────────────────────────────────── objectives / toasts (§6.4)

export const OBJ6 = {
  none: '',
  headEnd: '헤드엔드 — 200m',
  switch: '전환 스위치 — 동쪽 벽',
  bj: '비치 조인트 — 볼트실 남쪽 벽',
  stair: '계단 문 — 볼트실 서쪽 벽',
  pool: '문풀 — 계단 아래',
  tether: '테더 끊기 — 수직구 위 프레임',
  loader: '로더 파괴하기',
  /** (IA-6) the wait for the quiet: tether cut + loader dead, hostiles still awake (§4.8 fight-out) — was empty. */
  clear: '도크 확보',
  console: '도크 콘솔 — 데크 중앙',
};

export const TOAST6 = {
  restored: '체크포인트 복원됨',
  keyA: '키 A — 헤드엔드 모드',
  keyB: '키 B — 문풀',
  deep: '웅크리기엔 너무 깊음',
  crouch: '웅크리기 — C',
  vest: '방탄 조끼',
  plate: '방탄판',
  dogged: '해치가 아래에서 걸어 잠김',
  q: 'Q — 케슬러와 무전',
};

/** Interlock prompts (§2.2, §2.6.7, §4.6): story-set by the key held. */
export const PROMPT6 = {
  lockA: '키 A 삽입',
  lockANo: '인터록 키 A 필요',
  lockB: '인터록 — 키 B',
  lockBNo: '인터록 키 B 필요',
};

// ───────────────────────────────────────────────────────────── screens (§6.4)

export const SCREEN6 = {
  tubeCycling: '헤드엔드 튜브 — 순환 중',
  tubeOpen: '헤드엔드 튜브 — 열림',
  tubeClear: '튜브에서 비켜나세요',
  tubeClosed: '간선 터널 — 헤드엔드 튜브 — 닫힘',
  mimicAuto: '헤드엔드 — 볼트실 (비치 조인트) — 지상 2.1km\n문풀 — 테더 — 음향 부이: 대기\n모드: 자동',
  mimicManual: '헤드엔드 — 볼트실 (비치 조인트) — 지상 2.1km\n문풀 — 테더 — 음향 부이: 대기\n모드: 수동 — 보호 절체 해제',
  mimicPulled: '헤드엔드 — 볼트실 (비치 조인트) — 지상 2.1km: 신호 손실\n문풀 — 테더 — 음향 부이: 작동\n간선 광케이블 — 신호 손실 / 백업 링크 — 음향 부이 — 작동',
  queue: '헤드엔드 — 발송 대기열\n대기: 명세서 0031-H / B-14\n발송됨: B-01 … B-13\n수취인: —',
  switchAuto: '헤드엔드 모드: 자동',
  switchManual: '수동 — 키 A 뽑힘',
  bjIdle: '비치 조인트 — 인터록 키 A',
  bjOpen: '키 A 삽입됨 — 열림',
  bjLos: '광케이블 — 신호 손실',
  shaftIdle: '문풀 출입구 — 인터록 키 B',
  shaftOpen: '키 B 삽입됨 — 열림',
  /** Every screen after the pull (§4.6). */
  los: '간선 광케이블 — 신호 손실\n백업 링크 — 음향 부이 — 작동',
};
/** The HUD radio strip label (§4.1) and while the handset is held (§4.5). */
export const RADIO_LABEL6 = '4번 초소 — 지휘 — 채널 1';
export const HANDSET_LABEL6 = '음력 전화 — 4번 초소';

// ───────────────────────────────────────────────────────────── readables (§6.3)

/** `note6_transfer` names the reveal's time: `{reveal hh:mm}` — filled by `transferBody(hhmm)` (ST-b, at the reveal). */
export const transferBody = (hm: string) =>
  `B-14 사이클 시작 ${hm}. 적재 중. 화물 록: 밀봉 사이클 대기. 배수 34% — 정지됨. 보류: CHOIR. 인원: 없음 (무인 사이클).`;

export const FRAGMENTS6: Record<string, Fragment> = {
  note6_jobcard: {
    header: '작업 카드 — 예비 간선 조인트 — 중계기 2', style: 'tag', step: 3,
    body: 'J. 뢰드 (할시온 서브시) — 월 07:30.\n상태: 진행 중.\n페이아웃을 위해 드럼 스탠드 브레이크 해제함 (볼트실, CD2). 09:00까지 복귀.',
  },
  note6_queue: {
    header: '헤드엔드 — 발송 대기열', style: 'terminal', step: 3,
    body: '대기: 명세서 0031-H / B-14.\n클라스프 조립체 (경부용) ×240.\n발송: 문풀 → 해저 셔틀.\n발송됨: B-01 … B-13.\n수취인: —',
  },
  note6_jointer: {
    header: '수첩 — M. 리에, 할시온 서브시', style: 'paper', step: 4,
    body: '월. 광케이블이 살아 있어서 정전 창이 없다. 해군 말로는 광케이블이 끊겨도 부이가 다 받아낸단다. 느리지만 전해진다며. 내가 말했지: 그럼 테더도 끊어야 한다고.',
  },
  note6_transfer: {
    header: 'TRANSFER LOG — DOCK LOADER DL-2', style: 'terminal', step: 3,
    body: transferBody('--:--'),
  },
};
/** R8: a readable works only from inside its room (or region). */
export const READ_ROOM6: Record<string, string> = {
  note6_jobcard: 'rep6', note6_queue: 'he6', note6_jointer: 'vault6', note6_transfer: 'pool6',
};
export const LOG_IDS_L6 = Object.keys(FRAGMENTS6);
