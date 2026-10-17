// 화면 테마. CSS 쪽은 <html data-theme="N">로 바꾸고(public/theme-afterglow.css, theme-monochrome.css),
// 캔버스(기어/노트/키 빔 등)는 아래 CANVAS_THEMES 색을 GameInstance가 곡 시작 때 읽어서 쓴다.
// 판정 표시(판정 글자/콤보/피버/FAST·SLOW)는 테마 CSS, 타격 이펙트는 아래 hitFx, 결과 랭크 글자는 RANK_COLORS.
// 테마 1의 값은 모두 변경 전 고정값과 같음.

export const THEMES = [
  { id: 1, name: "DJMAX 스타일" },
  { id: 2, name: "AFTERGLOW (해 질 녘 시티팝)" },
  { id: 3, name: "MONOCHROME (화이트/블랙)" },
];

const MISSED = {
  main: "rgba(200, 205, 212, 0.5)",
  light: "rgba(232, 236, 240, 0.6)",
  dark: "rgba(150, 156, 164, 0.45)",
};
const FAILED_SINGLE = {
  main: "rgba(100, 100, 100, 0.3)",
  light: "rgba(120, 120, 120, 0.3)",
  dark: "rgba(80, 80, 80, 0.3)",
};

// 테마 1 = 기존 값 그대로(변경 전과 픽셀 단위로 동일해야 함)
export const CANVAS_THEMES = {
  1: {
    gearBg: "rgba(3, 7, 14, 0.8)",
    beamFrom: "rgba(150, 220, 255, 0.7)",
    beamTo: "rgba(150, 220, 255, 0)",
    uiText: "#7f95ab",
    uiFont: 'italic 700 18px "Barlow Condensed", sans-serif',
    coverFill: "#05080f",
    coverEdge: "#19d3ff",
    // 타격 이펙트 판정별 색(color = 후광/메인 링, accent = 코어/서브 링/스파크)
    hitFx: {
      shape: "circle",
      max: { color: "#00f0ff", accent: "#7af4ff" },
      high: { color: "#55ff00", accent: "#ffffff" },
      mid: { color: "#ffff00", accent: "#ffffff" },
      low: { color: "#ff003c", accent: "#ffffff" },
    },
    notes: {
      outer: { main: "#dcefff", light: "#ffffff", dark: "#6f93b0" },
      inner: { main: "#19d3ff", light: "#c4f5ff", dark: "#0a7fa6" },
      shift: { main: "#ffb400", light: "#ffe6a0", dark: "#9a6400" },
      // 롱노트 전용 색(단노트와 구분) / 누르고 있는 동안의 밝은 색
      long: { main: "#a98bff", light: "#e2d6ff", dark: "#5a3fb0" },
      longHold: { main: "#ece4ff", light: "#ffffff", dark: "#a98bff" },
      missed: MISSED,
      failedSingle: FAILED_SINGLE,
    },
  },
  // 테마 2 AFTERGLOW: 남보라 밤하늘 + 핫핑크/선셋 오렌지. 판정 글자(청록)와 겹치지 않는 노트 색.
  2: {
    gearBg: "rgba(14, 8, 30, 0.84)",
    beamFrom: "rgba(255, 92, 170, 0.6)",
    beamTo: "rgba(255, 150, 90, 0)",
    uiText: "#9a8cc0",
    uiFont: '600 17px "Barlow Condensed", sans-serif',
    coverFill: "#120a26",
    coverEdge: "#ff4fa3",
    // 노을 팔레트: 100% 핫핑크 → 선셋 오렌지 → 라벤더 → 코랄 레드
    hitFx: {
      shape: "circle",
      max: { color: "#ff4fa3", accent: "#ffd6ea" },
      high: { color: "#ffb347", accent: "#fff1dc" },
      mid: { color: "#b69cff", accent: "#f1e8ff" },
      low: { color: "#ff3b5c", accent: "#ffd0d8" },
    },
    notes: {
      outer: { main: "#f1e8ff", light: "#ffffff", dark: "#8e7cc0" },
      inner: { main: "#ff4fa3", light: "#ffc2e0", dark: "#a3226a" },
      // 기믹(레인 이동) 노트는 핑크와 구분되게 민트
      shift: { main: "#5ef2d6", light: "#cffff5", dark: "#1f8f7c" },
      // 롱노트 전용 색(선셋 오렌지) / 누르고 있는 동안의 밝은 색
      long: { main: "#ffb347", light: "#ffe0b0", dark: "#a8641a" },
      longHold: { main: "#ffe8c8", light: "#ffffff", dark: "#ffb347" },
      missed: MISSED,
      failedSingle: FAILED_SINGLE,
    },
  },
  // 테마 3 MONOCHROME: 흰 도면 배경 + 진회색 레인. 노트는 흰 막대 + 검은 테두리 + 모서리 브래킷.
  // 무채색 위에서 구분되도록 롱노트/기믹 노트만 주황/노랑 포인트.
  3: {
    gearBg: "rgba(46, 46, 48, 0.94)",
    beamFrom: "rgba(255, 255, 255, 0.5)",
    beamTo: "rgba(255, 255, 255, 0)",
    uiText: "#b8b8b8",
    uiFont: '700 18px "Barlow Condensed", sans-serif',
    coverFill: "#1c1c1d",
    coverEdge: "#ffffff",
    noteStyle: "bracket", // note.js _drawNoteHead: 검은 테두리 + 흰 모서리 브래킷(그림만, 크기 동일)
    // 무채색 마름모 이펙트: 100% 흰색 → 은회색 → 주황 → 빨강
    hitFx: {
      shape: "diamond",
      max: { color: "#ffffff", accent: "#ffffff" },
      high: { color: "#aab2ba", accent: "#ffffff" },
      mid: { color: "#ff6a2b", accent: "#ffe2d4" },
      low: { color: "#e0243a", accent: "#ffc9cf" },
    },
    notes: {
      outer: { main: "#ffffff", light: "#ffffff", dark: "#111111" },
      inner: { main: "#c9cdd1", light: "#ffffff", dark: "#111111" },
      shift: { main: "#ffd23f", light: "#fff3c4", dark: "#111111" },
      long: { main: "#ff6a2b", light: "#ffd2bd", dark: "#111111" },
      longHold: { main: "#ffe2d4", light: "#ffffff", dark: "#ff6a2b" },
      missed: MISSED,
      failedSingle: FAILED_SINGLE,
    },
  },
};

// 결과 화면 랭크 글자 색(테마 1 = 변경 전 값)
export const RANK_COLORS = {
  1: { S: "#ffb400", A: "#19d3ff", B: "#7ee8b0", C: "#c4f5ff", D: "#ff7a2f", F: "#ff3b5c" },
  2: { S: "#ffb347", A: "#ff4fa3", B: "#b69cff", C: "#f1e8ff", D: "#ff7a7a", F: "#ff3b5c" },
  // 테마 3은 랭크가 검은 상자 안이라 밝은 무채색 + 주황/빨강
  3: { S: "#ffffff", A: "#d6dade", B: "#aab2ba", C: "#8a9096", D: "#ff6a2b", F: "#e0243a" },
};

export function getRankColor(rank) {
  let id = 1;
  try {
    id = normalizeThemeId(document.documentElement.getAttribute("data-theme"));
  } catch (e) {
    id = 1;
  }
  return RANK_COLORS[id][rank] || "#ffffff";
}

export function normalizeThemeId(id) {
  const n = Number(id);
  return CANVAS_THEMES[n] ? n : 1;
}

// <html data-theme="N"> 적용(CSS 테마 전환)
export function applyTheme(id) {
  const themeId = normalizeThemeId(id);
  try {
    document.documentElement.setAttribute("data-theme", String(themeId));
  } catch (e) {
    // document 없음(테스트 환경 등)
  }
  return themeId;
}

// 현재 적용된 테마의 캔버스 색(곡 시작 시 1번 읽어서 고정)
export function getCanvasTheme() {
  let id = 1;
  try {
    id = normalizeThemeId(document.documentElement.getAttribute("data-theme"));
  } catch (e) {
    id = 1;
  }
  return CANVAS_THEMES[id];
}
