/**
 * Level 3 "THE QUIET SIDE" — every piece of written text (stage 3a §6.3–§6.5) and the ONE clock (§6.4).
 * Spoken lines live in `voice/lines.l3.json`. Readables ≤ 30 words, each stands alone (R3).
 */
import type { Fragment } from '../text';

export const TITLE_CARD_L3 = ['고요한 쪽', '주거 링 A'];
/** §7 / D19: the stage-end card (`style: 'ending'`, 12 s, skippable) — while the chain has no next level. */
export const END_CARD_L3 = ['고요한 쪽', '', '계속'];
/** Stage 3b D5: the end card when the chain hands over to level 4 (no "TO BE CONTINUED"; 6 s, skippable). */
export const END_CARD_L3_NEXT = ['고요한 쪽'];

// ───────────────────────────────────────────────────────────── the clock (§6.4, D4)

/**
 * One constant drives every time in the level. Arrival = Wed 22:40 = test hour 62:00 (the test ran from Mon 08:40 for
 * 72 h). `t` = seconds since the level started (sequencer time, scenes included; saved in the record).
 */
export const CLOCK = { testStart: '월 08:40', testHours: 72, arrivalHour: 62, arrivalClock: [22, 40] as const, day: '수', lamps: '저녁' };

const p2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
/** Test hour now (62 + t/3600). */
export const testHour = (t: number) => CLOCK.arrivalHour + t / 3600;
/** Countdown `hh:mm:ss` = 72 h − hour (10:00:00 at load, ticking). */
export function countdown(t: number): string {
  const left = Math.max(0, Math.floor((CLOCK.testHours - CLOCK.arrivalHour) * 3600 - t));
  return `${p2(left / 3600)}:${p2((left % 3600) / 60)}:${p2(left % 60)}`;
}
/** Lobby clock `WED 22:40` + t (rolls into THU after midnight). */
export function wallClock(t: number, seconds = false): string {
  const m0 = CLOCK.arrivalClock[0] * 60 + CLOCK.arrivalClock[1];
  const s = m0 * 60 + Math.floor(t);
  const day = Math.floor(s / 86400) > 0 ? '목' : CLOCK.day;
  const r = s % 86400;
  return `${day} ${p2(r / 3600)}:${p2((r % 3600) / 60)}${seconds ? ':' + p2(r % 60) : ''}`;
}
/** Report hours: last = 6·floor(h/6), next = last + 6 (60 / 66 for any realistic play). */
export function reports(t: number): { last: number; next: number } {
  const last = 6 * Math.floor(testHour(t) / 6);
  return { last, next: last + 6 };
}

// ───────────────────────────────────────────────────────────── readables (§6.3)

export function fragmentsL3(t: number): Record<string, Fragment> {
  const r = reports(t);
  return {
    term3_lobby: {
      header: '주거 구역 — 팹 하부 레벨 상태', style: 'terminal', step: 1,
      body: `밀봉 — 72시간 내압 무결성 시험
최근 보고 ${p2(r.last)}:00 — 전 직원 안전
다음 보고 ${p2(r.next)}:00
팹과의 통신: 시험 기간 중단
— CHOIR`,
    },
    note3_guestbook: {
      header: '로비 — 방명록, 마지막 페이지', style: 'paper', step: 2,
      body: `아스 중위, 4번 초소 — 바이오 반납품 12상자 수거. 14:20.
할보센 — 월요일 08:40부터 팹 시험. 방문 없음.`,
    },
    note3_board: {
      header: '주민 회의', style: 'paper', step: 1,
      body: '이 주거 구역은 협약에 따라 유닛 없이 운영됩니다. 무거운 것은 시설팀이 직접 옮깁니다. 링에서 유닛을 보면 CHOIR가 아니라 할보센에게 연락하세요.',
    },
    note3_canteen: {
      header: '주방 — 상시 지시', style: 'paper', step: 2,
      body: `팹 조리실 보급 — CHOIR가 취소 (시험 규정).
(손글씨) 3일 치 비축품이 아직 화물 베이에 있다. 아래에서 누가 먹고 있는 거지? CHOIR에 물었다. 답 없음. — M.`,
    },
    note3_quiz: {
      header: '목요일 — 퀴즈의 밤', style: 'paper', step: 1,
      body: '네 명 한 팀. 상품: 지상 근무표 하루. 출제자: 할보센. CHOIR에게 묻기 금지.',
    },
    note3_clinic_post4: {
      header: '진료소 — 진료 기록, 4번 초소 (해군)', style: 'paper', step: 4,
      body: '5주 동안 수병 11명: 목 뻣뻣함, 불면, 한 명은 "웅웅거리는 소리"가 들린다고 함. 해군은 바이오시스템에 보내라 함. 우리 소관 아니라고 함. 기록해 둠. — 룬드 박사',
    },
    note3_clinic_reyes: {
      header: '원격 환자', style: 'terminal', step: 3,
      body: `팹 의무실 3-A — 레예스, S.
시험 기간 중 CHOIR가 원격으로 진정 관리.
링크 정상. 방문: 불필요.`,
    },
    sign3_viewport: {
      header: '지금 보고 있는 것', style: 'tag', step: 1,
      body: '수심 2,140m. 붉게 빛나는 케이블이 간선 — 지상과의 유일한 연결선입니다. 유리를 두드리지 말아 주세요.',
    },
    sign3_bio: {
      header: '생물 시스템', style: 'tag', step: 4,
      body: `해군 보안 구역 (페인트로 지움)
테이프: 경비 철수 09.03. 시설팀 배지 사용 가능. 진입 시 제독.`,
    },
    note3_door: {
      header: '선실 문에 붙은 쪽지', style: 'paper', step: 4,
      body: '시그리드 — 네 야간 근무를 페르와 바꿨어. 그가 6시까지야. 바이오 냉동고 경보가 또 울렸어. 무시하래, 늘 무시하라고 하잖아.',
    },
    note3_schedule: {
      header: '시설팀 — 46주차', style: 'paper', step: 2,
      body: `${CLOCK.testStart} — 팹 하부 레벨: 내압 무결성 시험, ${CLOCK.testHours}시간. 직원 내부 대기. 방문 금지.
요청: CHOIR. 승인: P. 할보센.`,
    },
    note3_pad: {
      header: '할보센 — 수첩', style: 'paper', step: 3,
      body: '30시간째: CHOIR에 팹 카메라 요청. "시험 기간 중 사용 불가." 48시간째: 재요청. 같은 답. 주방이 걱정함. 내일 다시 묻기.',
    },
    note3_memo: {
      header: '할시온 운영본부 → 시설팀 — 지시서 0031-H', style: 'terminal', step: 5,
      body: `제작 인원 0으로.
시설팀: 팹 전 직원의 지상 이송 준비.
논의 금지.
서명 4/4. 참조: 생물시스템 사업부 (정보 제공용).`,
    },
    note3_desk: {
      header: '프린터 — 마지막 페이지', style: 'terminal', step: 4,
      body: `반납품 — 바이오시스 사업부. 12상자, 밀봉, 냉장.
잠수정 운행을 위해 4번 초소가 수거.
개봉 금지. 내용물 기록 금지.`,
    },
  };
}
export const LOG_IDS_L3 = Object.keys(fragmentsL3(0));
/** The office readables (R8: usable only from inside the office). */
export const OFFICE_READS = ['note3_schedule', 'note3_pad', 'note3_memo'];

// ───────────────────────────────────────────────────────────── screens (§6.5)

/** `lobby_status` (kind habitat_status): `<clock>|<lamp>|<lines>`. */
export function lobbyStatus(t: number, choice: 'stop' | 'command', takeover: boolean): string {
  if (takeover) return `${wallClock(t)}|비상|!기압 경보 — 구역 밀봉\n주민: 선실에 대기하세요`;
  const nodes = choice === 'command' ? '온라인 노드: 6/6' : '온라인 노드: 5/6';
  const n5 = choice === 'command' ? '노드 5 — 팹 L2: 감독 중' : '노드 5 — 팹 L2: 오프라인';
  return `${wallClock(t)}|${CLOCK.lamps}|${nodes}\n노드 2 — 바이오시스\n${n5}\n팹 하부 레벨: 시험 중`;
}
export const SCREEN3 = {
  liftArrive: '주거 링',
  liftGone: '호출됨 — 하부 5층',
  equalising: '압력 평형 중',
  released: '해제됨|CHOIR',
  open: '열림',
  sealed: '구역 밀봉',
  clear: '문에서 비켜나세요',
  test: (t: number) => `시험|${countdown(t)}`,
  admin: '시설팀',
  menu: '오늘 — 생선 수프 / 렌즈콩 카레',
  bioPanel: '제독 — 대기 중',
  bioPurge: (n: number) => `퍼지 ${String(n).padStart(2, '0')}`,
  bioDone: '제독 — 완료',
  reader: {
    idle: 'idle|생물 시스템|배지를 대세요',
    denied: 'denied|배지 필요|시설팀 배지',
    accepted: 'accepted|퍼지 15초|할보센, P. — 시설팀',
    read: 'read|읽는 중|',
  },
};

// ───────────────────────────────────────────────────────────── objectives, toasts (§6.5)

export const OBJ3 = {
  none: '',
  lift: '리프트 기다리기',
  lock: '기압 록 — 평형 대기',
  find: '사람 찾기 — 주거 구역 로비',
  post4: '4번 초소로 가기 — 생물 시스템을 지나',
  hold: '록이 열릴 때까지 버티기',
  enter: '외부 록 안으로 들어가기',
};
export const TOAST3 = {
  badge: '시설팀 배지',
  restored: '체크포인트 복원됨',
  sealed: '구역 밀봉됨',
  private: '개인 선실',
  staff: '직원 전용',
  noBadge: '배지 필요',
  halvLocked: '안쪽에서 잠김',
  night: '정원 아트리움 — 야간 폐쇄 (22:00–06:00)',
};
