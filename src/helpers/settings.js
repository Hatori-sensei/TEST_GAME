// 로컬 설정 저장소(localStorage). 앱을 껐다 켜도 설정이 유지되도록 한다.
// - version 필드로 구조를 구분하고, 저장된 값에 없는 항목은 DEFAULTS로 채운다.
// - DEFAULTS는 "설정을 안 건드렸을 때 지금 게임 동작"과 완전히 같은 값이어야 한다.
// - 저장이 실패해도(용량/권한 등) 게임은 기본값으로 계속 돈다.

export const SETTINGS_VERSION = 1;
const STORAGE_KEY = "djon.settings";

export const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  // 기존 설정(곡 선택 화면 퀵 설정)
  // null = 퀵 설정에서 배속을 저장한 적 없음 → 지금처럼 배속 설정 화면의 마지막 값(store)을 사용
  noteSpeed: null,
  keyMap: null, // null = 기본 d/f/j/k
  keyBeamEnabled: true,
  noteEffectEnabled: true,
  bgmVolume: 0.25, // Audio.maxVolume 기본값
  effectVolume: 0.5, // Audio.effectVolume 기본값
  // 새 설정(기본값 = 지금 동작)
  audioOffsetMs: 0, // + 면 노트가 늦게 옴(소리가 늦게 들리는 PC 보정)
  laneCover: 0, // 레인 상단 가림(서든) 비율 0~0.6
  bgaDim: 0.35, // BGA 위 검은 막 불투명도(기존 CSS 0.35)
  mirror: false, // 좌우 반전
  noFail: false, // 체력 0이어도 게임오버 안 됨
  showFastSlow: false, // FAST/SLOW 표시(기존엔 없던 표시라 기본은 끔)
  theme: 1, // 화면 테마(1 = 기존 디자인, 2 = AFTERGLOW)
  fxEnabled: true, // 채보 연출 효과(섬광/암전 등). 기존 채보엔 연출이 없어서 켜져 있어도 동작 동일
});

// 숫자 범위 보정(잘못 저장된 값이 들어와도 안전하게)
const RANGES = {
  noteSpeed: [1, 9.9],
  bgmVolume: [0, 1],
  effectVolume: [0, 1],
  audioOffsetMs: [-300, 300],
  laneCover: [0, 0.6],
  bgaDim: [0, 0.95],
  theme: [1, 2],
};

// 정수만 허용하는 항목
const INTEGER_KEYS = ["theme"];

function sanitize(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return out;
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    if (key === "version" || raw[key] === undefined || raw[key] === null) return;
    const def = DEFAULT_SETTINGS[key];
    const val = raw[key];
    if (RANGES[key]) {
      const num = Number(val);
      if (Number.isFinite(num)) {
        const clamped = Math.min(RANGES[key][1], Math.max(RANGES[key][0], num));
        out[key] = INTEGER_KEYS.includes(key) ? Math.round(clamped) : clamped;
      }
    } else if (typeof def === "boolean") {
      if (typeof val === "boolean") out[key] = val;
    } else if (key === "keyMap") {
      if (val && typeof val === "object") out[key] = { ...val };
    }
  });
  out.version = SETTINGS_VERSION;
  return out;
}

// 저장된 설정이 있는지(없으면 기존 동작을 그대로 유지하기 위해 아무것도 적용하지 않음)
export function hasSavedSettings() {
  try {
    return !!window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return false;
  }
}

export function loadSettings() {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    return sanitize(json ? JSON.parse(json) : null);
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

// 일부 항목만 넘겨도 기존 저장값과 합쳐서 저장
export function saveSettings(partial) {
  const next = sanitize({ ...loadSettings(), ...(partial || {}) });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    // 저장 실패 시 메모리 값만 사용
  }
  return next;
}

// 게임 화면(gameMixin)이 읽는 userProfile.gameSt 형태로 변환
export function toGameSt(s) {
  const gameSt = {
    keyBeamEnabled: s.keyBeamEnabled,
    noteEffectEnabled: s.noteEffectEnabled,
    audioOffsetMs: s.audioOffsetMs,
    laneCover: s.laneCover,
    bgaDim: s.bgaDim,
    mirror: s.mirror,
    noFail: s.noFail,
    showFastSlow: s.showFastSlow,
    fxEnabled: s.fxEnabled,
  };
  // 배속은 저장한 적 있을 때만 넣음(없으면 SpeedSetup이 store 값을 쓰는 기존 동작 유지)
  if (s.noteSpeed !== null && s.noteSpeed !== undefined) gameSt.noteSpeed = s.noteSpeed;
  return gameSt;
}
