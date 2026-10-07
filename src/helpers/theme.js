// 화면 테마. CSS 쪽은 <html data-theme="N">로 바꾸고(public/theme-military.css),
// 캔버스(기어/노트/키 빔 등)는 아래 CANVAS_THEMES 색을 GameInstance가 곡 시작 때 읽어서 쓴다.
// 판정 관련 표시(판정 글자/콤보/FAST·SLOW, 타격 이펙트의 판정별 색)는 테마와 무관하게 고정.

export const THEMES = [
  { id: 1, name: "DJMAX 스타일" },
  { id: 2, name: "MILITARY HUD (MUSYNX:RETURN 참고)" },
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
      missed: MISSED,
      failedSingle: FAILED_SINGLE,
    },
  },
  // 테마 2: 건메탈 바탕 + 앰버 신호색 + 본화이트. 각진 직사각형 노트, 차가운 기어.
  2: {
    gearBg: "rgba(9, 11, 10, 0.86)",
    beamFrom: "rgba(255, 186, 64, 0.55)",
    beamTo: "rgba(255, 186, 64, 0)",
    uiText: "#8c917f",
    uiFont: '600 16px "Barlow Condensed", Consolas, monospace',
    coverFill: "#0b0d0c",
    coverEdge: "#ffb21e",
    notes: {
      outer: { main: "#e6e8dc", light: "#ffffff", dark: "#5f6356" },
      inner: { main: "#ffb21e", light: "#ffe0a0", dark: "#8a5600" },
      // 기믹(레인 이동) 노트는 안쪽 앰버와 구분되게 청색
      shift: { main: "#5fd0ff", light: "#c8f0ff", dark: "#1d6f94" },
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
