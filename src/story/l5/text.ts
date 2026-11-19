/**
 * Level 5 "초소 4" — every piece of written text (stage 3c §6.3–§6.4) and the ONE clock (`CLOCK5`).
 * Spoken lines live in `voice/lines.l5.json` (read-only here). Readables ≤ 30 words, each stands alone (R3).
 * Foreshadowing rule (user): nothing here says outright that navy people are taken or controlled — the plan's texts only.
 */
import type { Fragment } from '../text';

export const TITLE_CARD_L5 = ['4번 초소', '에리두 심해 기지 — 해군 분견대'];
/** §7 / D3: the stage-end card (`style: 'ending'`, 12 s, skippable). */
export const END_CARD_L5 = ['4번 초소', '', '계속'];
/** The end card when the chain has a next level (tests only while `LEVELS[5].next` is null): 6 s, skippable. */
export const END_CARD_L5_NEXT = ['4번 초소'];

// ───────────────────────────────────────────────────────────── the clock (§6.4 CLOCK5)

/** The test hour at arrival when no carry brings one (62:30 = WED 23:10). */
export const ARRIVAL_DEFAULT5 = 62.5;
/** Test hour 0 = MON 08:40 (the link drill; level 3's `CLOCK.testStart`). */
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
/** Wall clock `WED 23:10` of a test hour. */
export function wallClock5(hour: number): string {
  const min = Math.floor((8 * 60 + 40) + hour * 60);
  const day = DAYS[Math.floor(min / 1440) % 7];
  const m = ((min % 1440) + 1440) % 1440;
  return `${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** `hh:mm` only. */
export const hhmm5 = (hour: number) => wallClock5(hour).slice(2);
/** `2d 14h 30m` of a test hour (the duty board's LINK DRILL counter; the screen counts up by itself). */
export function dhm5(hour: number): string {
  const m = Math.max(0, Math.floor(hour * 60));
  return `${Math.floor(m / 1440)}일 ${Math.floor(m / 60) % 24}시간 ${m % 60}분`;
}

// ───────────────────────────────────────────────────────────── objectives / toasts (§6.4)

export const OBJ5 = {
  none: '',
  find: '해군 찾기 — 4번 초소',
  survive: '살아남기',
  ready: '대기실로',
  radio: '무전기 가져가기',
  keypad: '스파인 문 열기 — 키패드',
  keypadCode: '스파인 문 열기 — 4719',
  door: '케슬러의 문 — 스파인 끝',
  line: '노란 선 위에 서기 — 문을 등지고',
  wheel: '갤러리 밸브 — 잠수함 베이 서쪽',
  tunnel: '간선 터널 — 바닥 높이, 남서쪽',
};

export const TOAST5 = {
  restored: '체크포인트 복원됨',
  radio: '무전기',
  q: 'Q — 케슬러와 무전',
  qCode: 'Q — 케슬러에게 코드 묻기',
  crouch: '웅크리기 — C',
  vest: '방탄 조끼',
  plate: '방탄판',
  dogged: '해치가 아래에서 걸어 잠김',
};

// ───────────────────────────────────────────────────────────── screens (§6.4)

export const SCREEN5 = {
  gateAuth: '승인: 아스, L. (중위) — 손바닥 — 생체 인식',
  gateClosed: '4번 게이트 — 닫힘 — 튜브 순환',
  gateClear: '게이트에서 비켜나세요',
  gateLog: (hm: string) => [`4번 게이트 — 최근 승인: 아스, L. (중위) — 손바닥 — 생체 인식 — ${hm}`, '이전: 아스, L. (중위) — 화 21:52', '이전: 아스, L. (중위) — 화 03:15'].join('\n'),
  aasPalm: (hm: string) => `white|done|아스, L. (중위) — 손바닥 — 생체 인식 — ${hm}`,
  onpost: (n: number) => String(n),
  dock: (dhm: string) => ['SDV 턴 — 크래들 — 발사 준비 완료', '간선 — 정상', '지휘 모듈 — 밀봉됨 (내부)', `링크 훈련 — 진행 중 ${dhm}`].join('\n'),
  keyOff: '권한 없음',
  keyReady: '코드 입력',
  keyTyping: (n: number) => `typing|${n}`,
  keyRejected: '코드 거부됨',
  keyAccepted: '승인됨',
  keyOpen: '열림',
  launchIdle: 'idle',
  launchComplete: 'complete',
  palmStandby: 'white|standby|발사',
  palmRefused: 'fail|명단에 없음 — 레예스, S.',
  ternIdle: '턴 — 크래들 — 발사 준비 완료',
  ternDone: '완료 — 장교 손바닥 인식 대기',
  tunnelIdle: '간선 터널 — 지휘관 권한',
  tunnelRelease: '지휘관 해제 — 유압 차단됨 ↑',
  tunnelOpen: '유압 복구됨 — 열림',
  cmdPanel: '지휘 모듈 — 차폐됨 — 내부에서 밀봉',
};
/** The HUD radio strip label (§8.6). */
export const RADIO_LABEL5 = '4번 초소 — 지휘 — 채널 1';
/** The ON POST board: 26 before the player is counted in (§1). */
export const ON_POST5 = 26;

// ───────────────────────────────────────────────────────────── readables (§6.3)

export const FRAGMENTS5: Record<string, Fragment> = {
  note5_visitors: {
    header: '방문 기록 — 4번 게이트 — 월요일', style: 'paper', step: 3,
    body: '05:10 할시온 보급 — 입 — 05:40 출.\n08:12 순데, A. (박사) — 바이오시스 — 긴급, 지휘관 면담 — 입.\n출: —',
  },
  note5_watch: {
    header: '근무 일지 — 당직실 — 월요일', style: 'paper', step: 3,
    body: '08:12 순데 박사, 지휘관 면담 요청, 긴급.\n08:38 지휘관, 순데 박사와 모듈로.\n08:40 전 초소: 링크 훈련.\n08:41',
  },
  note5_roster: {
    header: '모듈 근무 — 월 08:00–12:00', style: 'tag', step: 3,
    body: '리사 병장 · 외데고르 수병 · 하겐 상사 · 크누트센 수병.\n근무 중 모듈 밀봉. 수화기만 사용.',
  },
  note5_locker: {
    header: '7번 사물함 — H. 브레케 상사', style: 'paper', step: 4,
    body: '브레케 — 목걸이 점검이 월요일 08:40으로 옮겨졌어, 전원 참석. 서류 챙겨. 또 꼴찌로 오지 마.\n— L. 아스',
  },
  note5_mess: {
    header: '식당 게시판', style: 'paper', step: 2,
    body: '준비태세 시험 — 9일차. 모두 수고했다.\n케이크 월요일 15:00 (지휘관이 쏨).',
  },
  note5_arm: {
    header: '무기고 지급 — 월요일', style: 'paper', step: 4,
    body: '08:43 — 카빈 ×19, 권총 ×19, 탄창 ×76.\n지급자: —   서명: —   사유: —',
  },
  note5_mag: {
    header: '탄고 집계 — 5.56 / 9mm', style: 'paper', step: 4,
    body: '5.56: 40통. 월 08:44 인출: 19.\n9mm: 30통. 인출: 6.\n화재반 진입로: 스파인의 기어가는 통로.',
  },
  note5_dive: {
    header: '잠수 게시판 — SDV 턴', style: 'paper', step: 5,
    body: '화: 잠수 없음.\n화 22:00: 발사 전 점검 — 요청: CHOIR (정비).\n수: 발사 전 점검 — 요청: CHOIR.',
  },
};
/** R8: a readable works only from inside its room (or region). */
export const READ_ROOM5: Record<string, string> = {
  note5_visitors: 'gate5', note5_watch: 'duty5', note5_roster: 'duty5', note5_locker: 'ready5', note5_mess: 'mess5',
  note5_arm: 'arm5', note5_mag: 'arm5', note5_dive: 'dive5',
};
export const LOG_IDS_L5 = Object.keys(FRAGMENTS5);
