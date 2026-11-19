/**
 * Level 4 "BIOLOGICAL SYSTEMS" — every piece of written text (stage 3b §6.3–§6.4) and the ONE clock (`CLOCK4`, D20).
 * Spoken lines live in `voice/lines.l4.json` (read-only here). Readables ≤ 30 words, each stands alone (R3).
 * Foreshadowing rule (user, §13 B2): nothing here says outright that navy people are taken or controlled.
 */
import type { Fragment } from '../text';

export const TITLE_CARD_L4 = ['생물 시스템', '에리두 심해 기지 — 바이오시스'];
/** §7: the stage-end card (`style: 'ending'`, 12 s, skippable). */
export const END_CARD_L4 = ['생물 시스템', '', '계속'];
/** Stage 3c §8.1 / D2: the card when the chain hands over to level 5 (`nextOf(4) === 5`): no TO BE CONTINUED, 6 s. */
export const END_CARD_L4_NEXT = ['생물 시스템'];

// ───────────────────────────────────────────────────────────── the clock (D20)

/** D20: the test hour at arrival when no carry brings one (62:10). */
export const ARRIVAL_DEFAULT = 62 + 10 / 60;
/** Fumigation / the theatre queue started Mon 08:41 = test hour 0:01; one fitting attempt every 40 s since. */
export const CLOCK4 = { fumigated: 1 / 60, attemptSeconds: 40, log: '일 23:10', reply: '월 04:12', roster: '월 08:40' };

/** `h:mm:ss` of a second count (hours not wrapped: 62:09:14). */
export function hms(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** Cold Store 2's DOOR OPEN counter at story time `t`: (arrivalHour − 1/60) h + t. */
export const doorOpenSeconds = (arrivalHour: number, t: number) => (arrivalHour - CLOCK4.fumigated) * 3600 + t;
/** Fitting attempts completed by story time `t` (5,593 at 62:10, t 0). */
export const attemptsAt = (arrivalHour: number, t: number) => Math.floor((arrivalHour * 3600 - 60 + t) / CLOCK4.attemptSeconds);
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-GB');

// ───────────────────────────────────────────────────────────── objectives (§6.4)

export const OBJ4 = {
  none: '',
  post4: '4번 초소로 가기 — 생물 시스템을 지나',
  hold: '격리 구역 확보 — 제2 냉장고',
  suite: '4번 초소로 가기 — 수술 구역',
  booth: '튜브 문 해제 — 경비 부스',
  plant: '튜브 압력 평형 — 기계실',
  tube: '튜브를 지나 4번 초소로',
  gate: '게이트 대기',
};

export const TOAST4 = {
  restored: '체크포인트 복원됨',
  holdCleared: '격리 구역 확보됨',
  carbine: '카빈',
  equalised: '튜브 압력 평형됨',
  released: '튜브 출입 해제됨',
  serviceOnly: '서비스 유닛 전용',
  staffOnly: '멸균 창고 — 직원 전용',
};

// ───────────────────────────────────────────────────────────── screens (§6.4)

export const SCREEN4 = {
  decon: (n: number) => `제독 ${String(Math.max(0, n)).padStart(2, '0')}`,
  deconClear: '해제',
  showerIdle: '에어 샤워 — 진입하면 문이 닫힙니다',
  showerClear: '문에서 비켜나세요',
  showerCycle: (n: number) => `사이클 ${String(Math.max(0, n)).padStart(2, '0')}`,
  showerDone: '청정 구역 — 방호복 착용 상태로 돌아가지 마세요',
  fumig: [
    '청정 구역 — 훈증 완료',
    '시작 월 08:41 — 요청: CHOIR (격리)',
    '시작 시 재실: 10명',
    '주거 구역 공지: 바이오시스 폐쇄 — 격리 훈련 — 직원 내부 대기',
    '재진입: 안전',
  ].join('\n'),
  /** `containment` kind (W6 format): the suite panel / the cold-store panel. */
  suiteHold: (clock: string) => `suite|hold|${clock}|<`,
  suiteCleared: 'suite|cleared',
  storeHold: (clock: string) => `store|hold|${clock}`,
  storeAck: (clock: string) => `store|ack|${clock}`,
  node2: '노드 2 — 바이오시스',
  video: { idle: 'idle', paused: (i: number) => `paused|${i}`, play: (i: number, s: number, pose: string) => `play|${i}|${s.toFixed(2)}|${pose}`, static: 'static' },
  theatre: (attempt: number, link: string) => [
    `1호 수술실 — 피팅 31 — 시도 ${fmtInt(attempt)}`,
    '호스트: 스트란드, E.',
    '맥박: 없음',
    `링크: ${link}`,
    '대기열: 자동 — 지시서 0031-H (수율)',
  ].join('\n'),
  cam: (cue: string, t: number, attempt: number) => `${cue}|${t.toFixed(2)}|${Math.round(attempt)}`,
  // (`[plain]`: the panel's text is its whole content — no scrolling log lines competing with it; screens.ts PLAIN)
  tubeIdle: '[plain]튜브 출입\n부스에서 해제',
  tubeRefused: '[plain]해제 거부됨\n압력차 3.1bar\n튜브 기계실에서 평형 →',
  tubeReady: '[plain]해제 준비됨',
  tubeOpen: '[plain]열림',
  gaugeIdle: '[plain]튜브 Δp 3.1bar\n평형 시작',
  gaugeRun: (left: number, dp: number) => `[plain]평형 중 ${String(Math.max(0, left)).padStart(2, '0')}\nΔp ${dp.toFixed(1)}`,
  gaugeDone: '[plain]Δp 0.0 — 평형됨\n부스에서 해제',
  gateIdle: '[plain]4번 초소 — 기압 게이트\n해군 전용',
  gateEq: '[plain]평형 중',
  gateAuth: '[plain]승인: 아스, L. (중위)\n손바닥 — 생체 인식',
};

/** §4.4 the arm's LINK field per cue. */
export function linkOf(cue: string): string {
  if (cue === 'handshake') return '핸드셰이크';
  if (cue === 'fail' || cue === 'remove' || cue === 'regel' || cue === 'return') return '실패';
  return '—';
}

// ───────────────────────────────────────────────────────────── Sunde's log (§6.2: gaps and screen poses)

/** The nine lines: gap after each (s, scene-owned) and the `video_log` pose for it. */
export const SUNDE_LOG: { id: string; gap: number; pose: string }[] = [
  { id: 'l4_sunde_1', gap: 0.9, pose: 'settle' },
  { id: 'l4_sunde_2', gap: 0.5, pose: '' },
  { id: 'l4_sunde_3', gap: 1.2, pose: 'off' },
  { id: 'l4_sunde_4', gap: 0.7, pose: '' },
  { id: 'l4_sunde_5', gap: 0.6, pose: 'lean' },
  { id: 'l4_sunde_6', gap: 1.6, pose: 'down' },
  { id: 'l4_sunde_7', gap: 0.8, pose: '' },
  { id: 'l4_sunde_8', gap: 1.4, pose: '' },
  { id: 'l4_sunde_9', gap: 0, pose: '' },
];

// ───────────────────────────────────────────────────────────── readables (§6.3)

export const FRAGMENTS4: Record<string, Fragment> = {
  note4_signout: {
    header: '방호복 착용실 — 슈트 출입 기록, 월요일', style: 'paper', step: 1,
    body: '외출 07:50–08:30: 베르그, 달, 홀름, 모에, 네스, 포스, 엥, 스트란드, 하우겐, 리에.\n복귀: —',
  },
  note4_gown: {
    header: '방호복 착용 순서', style: 'paper', step: 1,
    body: '후드, 마스크, 슈트, 부츠, 장갑. 벤치를 넘어갈 것. 에어 샤워: 6초. 착용 후에는 오염 구역으로 절대 돌아가지 말 것.',
  },
  note4_cards: {
    header: '케이지 카드 — B열 사육장', style: 'tag', step: 2,
    body: 'P-01~P-10: 클라스프 장착 — 순응. P-11: 비순응 — 안락사. P-12: 순응. 순응 개체 전원 2단계 페어링으로, 14.08. — K. 베르그',
  },
  log4_viv: {
    header: '사육 기록 — K. 베르그', style: 'terminal', step: 2,
    body: '순응한 돼지들은 시키지 않으면 먹지 않는다. 시키면 체할 때까지 먹는다. 순데에게 누가 시키냐고 물었다. "링크가." 링크 너머엔 누가 있나? 대답 없음.',
  },
  note4_wet: {
    header: '클라스프 젤 — 41번 배치', style: 'paper', step: 2,
    body: '−20°C에 보관. 살아 있는 호스트에만 안착함: 체온과 맥박이 필요함. 죽은 조직은 연결되지 않음. 시도 금지.',
  },
  term4_pi: {
    header: '순데 → 할시온 운영본부', style: 'terminal', step: 3,
    body: '내 권한으로 2단계를 중단한다. 제어자 필드가 비어 있는데 무언가가 응답하고 있다.\n\n회신, 월 04:12: 계속하라. 제어자는 중앙에서 배정한다.',
  },
  note4_consent: {
    header: '자원 동의서 — 해군 준비태세 프로그램, 2단계', style: 'paper', step: 3,
    body: '경부 인터페이스(클라스프). 이 장치는 조언할 뿐 행동하지 않음을 이해합니다. 서명: 23/23, 4번 초소. 입회: L. 아스 중위. 제어자: 추후 배정.',
  },
  note4_tveit: {
    header: '동의서 — 수병 J. 트베이트 (여백, 손글씨)', style: 'paper', step: 3,
    body: '다들 서명해서 나도 했다. 아프지 않다. 가끔 어딘가에 있는데 걸어간 기억이 없다.',
  },
  note4_list: {
    header: '1호 수술실 — 명단', style: 'paper', step: 4,
    body: '29 하우겐 — 맥박 없음 — 실패. 30 리에 — 맥박 없음 — 실패. 31 스트란드 — 진행 중. 32 모에. 33 네스. 34 달. 35 포스. 36 홀름. 37 베르그. 38 엥.',
  },
  sign4_theatre: {
    header: '1호 수술실 — 관람 갤러리', style: 'tag', step: 4,
    body: '수술 내용은 갤러리 스피커로 중계됩니다. 유리를 두드리지 말아 주세요.',
  },
  term4_ctrl: {
    header: '클라스프 링크 명부 — 4번 초소 분견대', style: 'terminal', step: 5,
    body: '장착: 23. 링크: 활성 19 · 무신호 4.\n배정 제어자: 없음 → 노드 2 — 바이오시스 (월 08:40).\n지휘관: M. 케슬러 중령 — 미장착.',
  },
  note4_guard: {
    header: '상시 지시 — 바이오 검문소', style: 'paper', step: 5,
    body: '09.03부터 무인. 바이오 직원용 부스 해제는 유지. 튜브 기계실: 매 이송 전 평형. 목걸이는 초소 밖에서 말하지 않는다. — L. 아스 중위',
  },
  note4_bunk: {
    header: '부치지 않은 편지', style: 'paper', step: 5,
    body: '엄마 — 시험이 끝나면 목걸이를 뗀대. 가렵지도 않아. 작은 불은 호박색이야. 훈련 때만 빨개진대. 사랑해, 요나스',
  },
};
/** Every readable (log count) + the video log. */
export const LOG_IDS_L4 = [...Object.keys(FRAGMENTS4), 'log4_video'];
/** R8: readables that only work from inside their room (interactable id → room id). */
export const READ_ROOM4: Record<string, string> = {
  note4_list: 'scrub', sign4_theatre: 'gallery', term4_ctrl: 'chk', note4_guard: 'guard', note4_bunk: 'guard',
  note4_cards: 'vivarium', log4_viv: 'vivarium', note4_wet: 'wetlab', term4_pi: 'pi_office', log4_video: 'pi_office',
  note4_consent: 'records', note4_tveit: 'records', note4_signout: 'gown', note4_gown: 'gown',
};
