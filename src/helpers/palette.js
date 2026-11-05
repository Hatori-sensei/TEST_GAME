// [팔레트] 메인 테마(3 MONOCHROME)의 강조색. 노트(롱노트)·MAX 100% 판정/이펙트·UI 포인트 색이 바뀐다.
// - 화면(CSS)은 <html data-palette="id">를 보고 public/theme-monochrome.css의 --accent 변수를 바꾼다.
// - 캔버스(노트/이펙트)는 곡 시작 때 theme.js getCanvasTheme()가 withPalette()로 한 번 읽어 고정.
// - 테마 3에서만 동작(테마 1/2는 영향 없음).
// 우선순위: VS 자동 색 > 곡 지정(catalog.json의 palette) > Arcade 입장 때 고른 색 > 운영자 기본색 > 주황

export const PALETTES = {
  orange: { id: "orange", name: "ORANGE", accent: "#ff5a1f", accentRgb: "255, 90, 31", light: "#ffc2a6", soft: "#ffe2d4" },
  red: { id: "red", name: "RED", accent: "#e8334a", accentRgb: "232, 51, 74", light: "#ffc4cb", soft: "#ffe3e6" },
  blue: { id: "blue", name: "BLUE", accent: "#3b82ff", accentRgb: "59, 130, 255", light: "#bcd3ff", soft: "#dfe9ff" },
  green: { id: "green", name: "GREEN", accent: "#19b86b", accentRgb: "25, 184, 107", light: "#bff0d6", soft: "#e1f8ec" },
  purple: { id: "purple", name: "PURPLE", accent: "#8a4dff", accentRgb: "138, 77, 255", light: "#dccbff", soft: "#efe6ff" },
};
export const PALETTE_IDS = Object.keys(PALETTES);
export const DEFAULT_PALETTE = "orange";
// LAN 대전 입장 순서대로 배정(서버 electron/lan-server.js의 VS_COLORS와 같아야 함)
export const VS_COLORS = ["red", "blue", "green", "purple"];

export function isPaletteId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(PALETTES, id);
}

export function normalizePaletteId(id) {
  return isPaletteId(id) ? id : DEFAULT_PALETTE;
}

// <html data-palette="id"> 적용
export function applyPalette(id) {
  const pid = normalizePaletteId(id);
  try {
    document.documentElement.setAttribute("data-palette", pid);
  } catch (e) {
    // document 없음
  }
  return pid;
}

export function getPaletteId() {
  try {
    return normalizePaletteId(document.documentElement.getAttribute("data-palette"));
  } catch (e) {
    return DEFAULT_PALETTE;
  }
}

// VS 플레이어 색 표시용(없거나 모르는 값이면 "")
export function accentOf(id) {
  return isPaletteId(id) ? PALETTES[id].accent : "";
}

export function getPalette(id = getPaletteId()) {
  return PALETTES[normalizePaletteId(id)];
}

// 곡을 칠 때 쓸 팔레트(우선순위대로 첫 번째 유효한 값). 기본값 fallback은 운영자 설정색
export function resolveGamePalette({ vsColor, songPalette, sessionPalette, defaultPalette } = {}) {
  return [vsColor, songPalette, sessionPalette, defaultPalette].find(isPaletteId) || DEFAULT_PALETTE;
}

// 캔버스 테마에 팔레트 강조색 반영(복사본). 롱노트/누르는 중/MAX 100% 이펙트만 바뀜
export function withPalette(canvasTheme, id = getPaletteId()) {
  const p = getPalette(id);
  return {
    ...canvasTheme,
    hitFx: { ...canvasTheme.hitFx, max: { color: p.accent, accent: p.light } },
    notes: {
      ...canvasTheme.notes,
      long: { ...canvasTheme.notes.long, main: p.accent, light: p.light },
      longHold: { ...canvasTheme.notes.longHold, main: p.soft, dark: p.accent },
    },
  };
}
