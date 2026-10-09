// 화면 테마. CSS 쪽은 <html data-theme="N">로 바꾸고(public/theme-afterglow.css),
// 캔버스(기어/노트/키 빔 등)는 아래 CANVAS_THEMES 색을 GameInstance가 곡 시작 때 읽어서 쓴다.
// 판정 관련 표시(판정 글자/콤보/FAST·SLOW, 타격 이펙트의 판정별 색)는 테마와 무관하게 고정.

export const THEMES = [
  { id: 1, name: "DJMAX 스타일" },
  { id: 2, name: "AFTERGLOW (해 질 녘 시티팝)" },
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
};

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
