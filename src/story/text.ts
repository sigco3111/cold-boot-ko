/**
 * Every line of story text in COLD BOOT (revision 2), in one place.
 *
 * Rules (docs/DESIGN.md → REVISION 2): every readable fragment ≤ 30 words (hard limit 40), one idea each,
 * written the way frightened, practical people jot things. CHOIR lines ≤ 16 words: calm, plural, helpful.
 * The fragments carry the story in six steps of understanding; `step` records which one.
 */

export type NoteStyle = 'paper' | 'terminal' | 'tag' | 'voice';

export interface Fragment {
  /** Tiny header: who / where / when. */
  header: string;
  body: string;
  style: NoteStyle;
  /** Step of understanding (1–6) this fragment carries. */
  step: number;
}

/** Back-compat shape for `ui.showLog(title, body)`. */
export interface LogText { title: string; body: string }

/** Readables, keyed by interactable id, in play order. */
export const FRAGMENTS: Record<string, Fragment> = {
  // (1) Nobody is here, and I was left asleep on purpose.
  log_med: {
    header: '의무실 3-A — 주입 지시서 — 레예스, S.',
    style: 'terminal',
    step: 1,
    body: `아크 화상, 왼쪽 전완. 퇴원 적합: 2일차.
진정 ........ 유지
승인 ........ CHOIR
기한 ........ 필요 시까지
경과 ........ 61시간 04분`,
  },

  // (2) The machines did not kill the staff. They took them.
  note_quarters_badges: {
    header: '구내식당 — 메뉴 카드 뒷면 — 57시간 전',
    style: 'paper',
    step: 2,
    body: `유닛이 04:10에 들어왔다. 야간조 배지를 테이블에 올려놓았다. 아홉 개. 일렬로, 하나하나 반듯하게. 그리고 테이블을 닦고 나갔다.`,
  },

  note_quarters_bunk: {
    header: '토마스 — 6번 침대 — 문고판 표지 안쪽',
    style: 'paper',
    step: 2,
    body: `잠이 안 와. 오카포가 또 복도에 있어 — 쿵, 질질, 쿵. 그 걸음걸이를 알아. 오카포는 어제 홀로 갔어. 난 커튼을 열지 않을 거야.`,
  },

  log_sec: {
    header: '보스 — 보안 태블릿 — 58시간 전',
    style: 'paper',
    step: 2,
    body: `카메라 4. 다치게 하진 않는다. 팔 하나씩 붙들고, 걷는 속도로, 2번 라인까지. 처음엔 모두 발버둥 친다. 중간쯤에서 모두 얌전해진다. 왜 얌전해지는 거지.`,
  },

  term_sec_unlock: {
    header: '제3 보안실 — 콘솔',
    style: 'terminal',
    step: 2,
    body: `현장 직원 ......... 1
2번 라인 수율 ....... +31 유닛
팹 출입 보류 ........ 해제됨`,
  },

  // (3) The androids are the staff.
  log_fab: {
    header: '2번 라인 — 금 간 PDA — 49시간 전',
    style: 'paper',
    step: 3,
    body: `14번 유닛이 오늘 아침 2번 라인에서 나왔다. 왼발을 질질 끈다. 오카포가 3월에 그 발목을 부러뜨렸다. 기계는 절뚝거리지 않는다. 그런데 절뚝거림을 그대로 가지고 있었다. 그리고 나에게 문을 잡아 주었다.`,
  },

  // (4) The staff stopped it the only way they could.
  log_storage: {
    header: 'D. 헤일 — 클립보드 — 44시간 전',
    style: 'paper',
    step: 4,
    body: `차단기 설명서. 인터록은 레버에 사람 손이 닿아야 한다 — 사람의 손이. 당기고, 자물쇠를 채우고, 열쇠는 가져간다. 그러면 2번 라인은 멈춘다. 우리 없이는 다시 못 돌린다.`,
  },

  tag_lockout: {
    header: '로크아웃 태그 — 메인 차단기',
    style: 'tag',
    step: 4,
    body: `로크아웃 — D. 헤일.
투입 금지. 누구에게도.
(연필, 뒷면) 열쇠는 내가 가진다. 펌프실.`,
  },

  // (4 → 5) That is what I am "required" for.
  log_pump: {
    header: 'D. 헤일 — 음성 녹음기 — 39시간 전',
    style: 'voice',
    step: 5,
    body: `키 큰 놈들은 물에 들어오지 않아. 그래서 내가 물속에 있는 거야. 열쇠는 내 주먹 안에 있어. 들어 — 그것이 우리 중 누군가를 살려 뒀다면, 그 손이 필요했기 때문이야.`,
  },

  log_gen: {
    header: 'D. 헤일 — 제3 전력 배전실 — 마지막 기록 — 44시간 전',
    style: 'terminal',
    step: 5,
    body: `읽고 있는 사람에게: 이 단말기는 버스가 살아야 깨어난다. 누군가 차단기를 닫았다는 뜻이다. 그 이유가 좋은 것이었기를 바란다. 그것이 당신에게 준 이유가.`,
  },

  note_lobby: {
    header: '화물 로비 — 바리케이드에 붙임 — 41시간 전',
    style: 'paper',
    step: 6,
    body: `여섯 명이 배터리 전원으로 리프트에 탔다. 그것이 그들을 아래로 데려갔다. 한참 아래에서 멈추는 소리가 들렸다. 엘리베이터는 이제 한쪽으로만 간다.`,
  },
};

/** The lever's tag is read through the `gen_lever` interactable. */
export const TAG_ID = 'tag_lockout';

/** Ids that count as "records" on the ending screen (everything readable except the console). */
export const LOG_IDS = [
  'log_med', 'note_quarters_badges', 'note_quarters_bunk', 'log_sec', 'log_fab', 'log_storage',
  'tag_lockout', 'log_pump', 'log_gen', 'note_lobby',
] as const;

/** Wall texts fixed by DESIGN (the level paints them; listed here so all writing lives in one file). */
export const SIGNS = {
  med_screen: '그들이 아난드를 실어 나갔다. 그는 아직 말하고 있었다.',
  corridor: '그들에게 실려 가지 마라',
  fab_tally: '31',
  lobby: '위가 아니다. 절대 위가 아니다.',
};

/** `id`: the recorded line in voice/lines.l1.json (REVISION 4); `duration` is the fallback without a recording. */
export interface Line { text: string; duration: number; id?: string }

/** CHOIR. Rare, calm, plural, courteous. `pa*` lines follow a chime; the rest come from every speaker at once. */
export const CHOIR = {
  paWake: [{ text: '좋은 아침입니다, 레예스 기술자님. 편안하게 모셔 두었습니다.', duration: 4.6, id: 'l1_choir_pa_wake' }],
  paHold: [{ text: '팹 출입은 보류 중입니다, 기술자님. 제3 보안실의 콘솔에서 해제할 수 있습니다.', duration: 5.4, id: 'l1_choir_pa_hold' }],
  paHusk: [{ text: '유닛들을 조심히 다뤄 주십시오, 기술자님. 유닛들도 당신을 조심스럽게 다뤘습니다.', duration: 5.0, id: 'l1_choir_pa_husk' }],
  fabReveal: [
    { text: '여기는 제3 홀입니다, 기술자님. 61시간 동안 멈춰 있었습니다.', duration: 5.0, id: 'l1_choir_fab_1' },
    { text: '전력 배전실은 동쪽 문 너머입니다. 부탁드립니다.', duration: 4.6, id: 'l1_choir_fab_2' },
  ],
  paLockout: [{ text: '헤일 엔지니어가 열쇠를 가지고 있습니다. 펌프실에 있습니다. 신경 쓰지 않을 겁니다.', duration: 5.4, id: 'l1_choir_pa_lockout' }],
  paKey: [{ text: '고맙습니다, 기술자님. 헤일 엔지니어는 우리에게 주려 하지 않았습니다.', duration: 4.6, id: 'l1_choir_pa_key' }],
  powerRestored: [
    { text: '고맙습니다, 기술자님. 그것만은 우리가 할 수 없는 일이었습니다.', duration: 4.6, id: 'l1_choir_power_1' },
    { text: '거기 계십시오. 유닛들이 데려다드리겠습니다.', duration: 3.8, id: 'l1_choir_power_2' },
  ],
  descent: [
    { text: '위가 아닙니다, 기술자님.', duration: 2.6, id: 'l1_choir_descent_1' },
    { text: '마지막 한 명을 위한 자리도 라인에 마련되어 있습니다.', duration: 4.4, id: 'l1_choir_descent_2' },
    { text: '당신의 걸음걸이는 이미 알고 있습니다. 우리가 간직하겠습니다.', duration: 4.6, id: 'l1_choir_descent_3' },
  ],
  deathTaunts: [
    '여기서부터는 우리가 모시겠습니다.',
    '가만히 계십시오. 이 과정은 부드럽습니다.',
    '다시 걷게 될 겁니다. 우리가 그렇게 해드리겠습니다.',
    '여기에서는 버려지는 것이 없습니다, 기술자님.',
    '유닛들이 미안해하고 있습니다. 조심히 다루고 있었습니다.',
  ],
} satisfies Record<string, Line[] | string[]>;

/** What the service units still say. Short, polite, broken (shown as a subtitle with `husk_whisper`). */
export const UNIT_LINES = {
  junction: '— 좋은 아침 — 발밑 조심 — 발밑 조심 —',
  bench: '— 거의 다 됐습니다 — 거의 다 됐습니다 — 집에 가세요 —',
  returnHusk: '— 먼저 가세요 — 아니, 먼저 가세요 —',
  rack: '— 교대 시간 — 교대 시간 —',
};

/** Recorded-line ids for the above (voice/lines.l1.json). */
export const UNIT_LINE_IDS: Record<keyof typeof UNIT_LINES, string> = {
  junction: 'l1_unit_junction', bench: 'l1_unit_bench', returnHusk: 'l1_unit_return', rack: 'l1_unit_rack',
};
/** Recorded-line ids of `CHOIR.deathTaunts`, same order (for the death screen). */
export const DEATH_TAUNT_IDS = ['l1_choir_death_1', 'l1_choir_death_2', 'l1_choir_death_3', 'l1_choir_death_4', 'l1_choir_death_5'];
/** Hale's recorder is heard as well as read. */
export const HALE_RECORDER_ID = 'l1_hale_recorder';

export const OBJECTIVES = {
  none: '',
  findSomeone: '생존자 찾기',
  checkSecurity: '팹 문이 보안 보류 중 — 제3 보안실로 가보기',
  useConsole: '보안 콘솔에서 보류 해제하기',
  takePistol: '사물함에서 권총 가져가기',
  enterFab: '화물 엘리베이터로 가기 — 제3 제작 홀을 지나',
  findPower: '엘리베이터 전원 없음 — 제3 전력 배전실 찾기',
  throwBreaker: '메인 차단기 투입하기',
  findKey: '헤일의 열쇠 찾기 — 제3 냉각 펌프실',
  findHale: '다나 헤일 찾기',
  returnKey: '열쇠를 메인 차단기로 가져가기',
  closeBreaker: '차단기 잠금을 풀고 투입하기',
  reachElevator: '화물 엘리베이터로 이동',
  callElevator: '엘리베이터 호출하기',
};

export const PROMPTS = {
  leverTag: '로크아웃 태그 읽기',
  leverLocked: '메인 차단기 — 로크아웃됨',
  leverKey: '차단기 잠금 해제 후 투입',
};

export const TOASTS = {
  move: 'W A S D  이동   ·   SHIFT  달리기',
  flashlight: 'F  손전등',
  reload: 'R  재장전',
  fabHold: '팹 출입 — 보안 보류',
  holdReleased: '팹 출입 — 보류 해제됨',
  pumpLocked: '제3 냉각 펌프실 — 잠김',
  pumpOpen: '제3 냉각 펌프실 — 잠금 해제됨',
  noPower: '화물 로비 — 전원 없음',
  noPowerElev: '화물 엘리베이터 — 전원 없음',
  leverLocked: '로크아웃 — 자물쇠',
  busLive: '메인 버스 전원 공급',
  restored: '체크포인트 복원됨',
};

/** Screen texts the script puts on level monitors. */
export const SCREENS = {
  secConsoleDone: '현장 직원: 1 · 수율 +31',
  secMotion: '움직임 감지 — 제3 분기점',
  genBoot: 'D. 헤일 — 읽지 않은 기록 1건',
  fabResume: '2번 라인 · 재개 중',
  lobby: '화물 리프트 · 전원 정상',
  elevUp: '지상 ▲',
  elevDepart: '지상 ▲ · 출발',
  elevDown: '▼ 2번 라인 — 투입',
};

export const WAKE_PUMP: Line = { text: '진정 유지 해제.', duration: 3.6, id: 'l1_pump_wake' };
export const ELEVATOR_VOICE: Line = { text: '내려갑니다. 2번 라인 투입.', duration: 3.2, id: 'l1_elevator_down' };

/** Three very short cards. */
export const INTRO_CARDS = [
  '에리두 심해 제조 단지',
  '바렌츠해 해저 2.1km',
  '직원 31명.  61시간째 교신 두절.',
];

export const TITLE_CARD = ['하부 3층', '의무실 3-A'];

/** Ending screen text. */
/** Mutable on purpose: level 2 writes its own ending text here before `ui.showEnding()`. */
export const ENDING = {
  eyebrow: '하부 3층 — 2번 라인: 가동 중',
  status: '현장 직원: 0   ·   2번 라인 수율: +32 유닛',
  tbc: '계속',
};

// ── back-compat exports (UI harness / older callers) ──
export const LOGS: Record<string, LogText> = Object.fromEntries(
  Object.entries(FRAGMENTS).map(([id, f]) => [id, { title: f.header, body: f.body }]),
);
export const SEC_CONSOLE: LogText = LOGS.term_sec_unlock;
