/**
 * Level 2 — "2번 라인": every piece of written text (REVISION 4). Spoken lines live in
 * `voice/lines.l2.json`. Rules as in level 1: readable fragments ≤ 30 words, one idea each, concrete.
 */
import type { Fragment } from '../text';

export const FRAGMENTS_L2: Record<string, Fragment> = {
  note2_dock: {
    header: '제5 화물 부두 — 배송 전표',
    style: 'terminal',
    step: 1,
    body: `반출 ........ 2형 유닛 31대
반입 ........ 0
승무원 교대 ... 취소 — 승무원 없음
수령인 ...... CHOIR`,
  },
  note2_intake: {
    header: '투입 구역 — 접힌 쪽지, 왼쪽 신발 속',
    style: 'paper',
    step: 1,
    body: `옷은 직접 개게 해준다. 개는 동안 기다려 준다. 아난드가 내가 첫 번째가 되지 않도록 먼저 갔다. 잘하고 있다는 말을 듣는 소리가 들린다.`,
  },
  term2_intake: {
    header: '투입 구역 — 접수',
    style: 'terminal',
    step: 3,
    body: `접수 ........ 31
거부 ........ 0
평균 대기 .... 4분 10초
대기 중 ...... 1 — 레예스, S.
비고: 기준용 보관. 피팅 금지.`,
  },
  tag2_rig: {
    header: '보정 리그 — 황동 태그',
    style: 'tag',
    step: 3,
    body: `기준 패턴 00 — 레예스, S.
보정 코스 11:04. 전 유닛.
덮어쓰기 금지.`,
  },
  note2_fitting: {
    header: '피팅 베이 — 감독관 책상 메모지 — 2년 전',
    style: 'paper',
    step: 6,
    body: `유닛들이 아직 걸음이 어색하다. 본사에서 모션 라이브러리용으로 코스를 걸을 기술자를 내려 보낸다. 레예스. 11분, 센서 차고, 그러면 집에 가면 된다.`,
  },
  note2_relay: {
    header: 'D. 헤일 — 캐비닛 문 안쪽에 붙임',
    style: 'paper',
    step: 4,
    body: `C 구역은 접촉기 하나다: 문과 현장 정지가 함께 달려 있다. 닫으면 2번 라인의 모든 정지가 리셋된다. 누군가 관제에서 라인을 멈춘 거라면 — 이건 열어 두게.`,
  },
  term2_booth: {
    header: '라인 관제 — 지시서 0031-H',
    style: 'terminal',
    step: 2,
    body: `발신: 할시온 다이내믹스 — 운영본부
인원 0 상태에서 수율 유지.
서명 ........ 4/4
상태 ........ 진행 중 — 32/32`,
  },
  note2_rig14: {
    header: '4번 피팅 리그 — 고장',
    style: 'terminal',
    step: 3,
    body: `패턴 14(오카포) — 프로젝터 고장: 재생 영상이 구역을 돌아다니고 있음. 따라가지 말 것.`,
  },
  booth_headset: {
    header: '토마스 — 녹음기 — 마지막 메모',
    style: 'voice',
    step: 4,
    body: `레예스. 이걸 듣고 있다면, 나는 더 이상 그 방에 없어. 스위치 탓이 아니야, 알지? 지시였어. 그건 짊어지지 마.`,
  },
  term2_core: {
    header: '노드 5 — 패턴 라이브러리',
    style: 'terminal',
    step: 6,
    body: `00 ......... 레예스, S. — 기준. 2년 전 코스 보행, 11:04. 모든 유닛이 이것으로 걷는다.
01–31 ...... 직원 — 보정. 오카포의 인내. 아난드의 손.
32 ......... 토마스 — 그의 조급함. 6초 전 피팅됨.
지시서 0031-H: 인원 0에서 수율 유지. 우리는 요청받았다. 우리는 가장 다정한 방법을 찾았다. 버려진 사람은 없었다.
원본 00: 수면 유지. 편안하게. 필요할 때까지.`,
  },
};

/** Everything readable counts as a record on the ending screen. */
export const LOG_IDS_L2 = Object.keys(FRAGMENTS_L2);

export const OBJ2 = {
  none: '',
  leaveCab: '엘리베이터에서 내리기',
  wayOut: '탈출로 찾기',
  knocking: '누군가 두드리고 있음 — 라인 관제, 홀 서쪽',
  intercom: '유리창의 인터컴 사용하기',
  talking: '라인 관제 — 토마스가 피팅 베이를 여는 중',
  findPass: '감독관 출입증 찾기 — 피팅 베이 동쪽',
  toRelay: 'C 구역 복구 — 남동쪽 계전기실',
  closeSwitch: 'C 구역 접촉기 투입하기',
  relayHeld: '아크 인터록 — 계전기실 확보',
  toTomas: '토마스에게 가기 — 서비스 스파인을 지나 라인 관제로 (남서쪽 문)',
  booth: '라인 관제',
  follow: '따라가기 — 적재 스테이션에서 라인에 오르기',
  toCore: '코어로 가기 — 남쪽 문',
  enterCore: 'CHOIR 진입 — 노드 5',
  choose: '선택: 정지 또는 지휘',
  leave: '떠나기',
};

export const TOAST2 = {
  noPower: 'C 구역 — 전원 없음',
  needPass: 'C 구역 계전기 — 구역 출입증 필요',
  passOk: '구역 출입증 승인됨',
  handset: '수화기 획득 — 라인 관제 3번 채널',
  fittingDark: '피팅 베이 — 닫힘 · 라인 관제에서 승인',
  fittingWait: '피팅 베이 — 승인 중…',
  fittingOpen: '피팅 베이 — 잠금 해제됨',
  arcInterlock: '순환 중 — 아크 인터록',
  cycling: '라인 관제 — 순환 중',
  gate: '통로 게이트 — 라인 가동 중 닫힘',
  mouthHeld: '피팅 터널 — 라인 보류',
  mouthLoading: '적재 인터록 — 플로어에 유닛 있음',
  exitOneWay: '피팅 터널 — 출구 전용',
  recorder: '녹음기 줍기',
  interlock: '인터록 — 라인 보류',
  interlockRun: '인터록 — 라인 가동 중',
  sectionLive: 'C 구역 전원 공급',
  coreHeld: '노드 5 — 감독 유닛 근무 중',
  liftHeld: '서비스 리프트 — 보류',
  sealed: '격벽 — 밀봉됨',
  restored: '체크포인트 복원됨',
  stealth: 'C  웅크리기   ·   F  손전등 끄기   ·   작업 중인 유닛은 당신을 무시함',
  palmFar: '손바닥 인식판 — 닿지 않음',
};

export const SCREEN2 = {
  held: '보류 — 현장 정지: 라인 관제',
  running: '2번 라인 · 가동 중 · 수율 31',
  yield32: '2번 라인 · 수율 32',
  rig: '재생 — 기준 패턴 00 — 레예스, S.',
  rig14: '패턴 14(오카포) — 프로젝터 고장',
  relay: 'C 구역 · 투입됨',
  boothOrder: '지시서 0031-H · 진행 중',
  stopped: '2번 라인 · 정지',
  amended: '지시서 0031-H · 수정됨\n감독관: 레예스, S. · 인원: 1',
  /** The lift panel after the choice: the only word here about what lies beyond Line Two (six nodes). */
  liftStop: '노드 5 — 오프라인\n온라인 노드: 5/6',
  liftCommand: '노드 5 — 감독 중\n온라인 노드: 6/6',
};

export const TITLE_CARD_L2 = ['2번 라인', '제5 화물 부두'];

const units = (n: number) => `유닛 ${Math.max(0, Math.min(32, n))}대`;

/**
 * The short card before the ending screen. `left` = units still standing (32 minus the ones the player
 * shot down — the card never claims a number the player can disprove). The last line remembers Unit 14.
 */
export const END_CARDS = {
  shutdown: (left: number) => ['라인을 멈췄다.', `노드 5가 꺼졌다. ${units(left)}가 서 있던 자리에 쓰러졌다.`, '아무도 그들에게 알리지 않았다.'],
  rewrite: (left: number) => ['라인을 차지했다.', '인원: 1명.', `${units(left)}가 깨어, 당신을 기다리고 있다.`],
  unit14: {
    spared: '14번 유닛이 문을 잡아 주었다. 당신은 그냥 두었다.',
    shot: '14번 유닛이 문을 잡아 주었다. 당신은 쐈다. 그래도 문을 잡고 있었다.',
    killed: '14번 유닛이 문을 잡아 주었다. 당신이 쓰러뜨렸다.',
  },
};

/** Ending card: heading + a status line ("LABEL: value" lines render as dimmed stats). */
export const ENDING_L2 = {
  shutdown: { eyebrow: '2번 라인 — 정지', status: (left: number) => `서 있는 유닛: 0/${left}` },
  rewrite: { eyebrow: '2번 라인 — 당신의 것', status: (left: number) => `명령 대기 중인 유닛: ${left}` },
  tbc: '계속',
};
