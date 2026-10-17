// [모드] Arcade 최종 점수. 곡마다 화면에 뜨는 점수(100만점 만점)는 그대로 두고,
// 3곡을 다 친 뒤 최종 점수를 낼 때만 난이도 배율을 곱한다.
//   최종 = Σ 곡 점수 × (1 + 레벨 × BONUS_PER_LEVEL)
// 레벨은 LEVEL_MIN~LEVEL_MAX로 자른다(외부 곡 폴더 catalog.json에 아무 값이나 들어올 수 있으므로).

export const BONUS_PER_LEVEL = 0.02;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 30;

export function clampLevel(level) {
  const n = Math.round(Number(level) || 0);
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n));
}

export function multiplierOf(level) {
  return 1 + clampLevel(level) * BONUS_PER_LEVEL;
}

export function computeFinal(stages = []) {
  const rows = stages.map((st) => {
    const level = clampLevel(st.level);
    const multiplier = multiplierOf(level);
    const score = Math.max(0, Math.floor(Number(st.score) || 0));
    return {
      sheetId: st.sheetId,
      title: st.title,
      level,
      score,
      multiplier,
      weighted: Math.round(score * multiplier),
      failed: !!st.failed,
      hidden: !!st.hidden,
    };
  });
  const base = rows.reduce((sum, r) => sum + r.score, 0);
  const total = rows.reduce((sum, r) => sum + r.weighted, 0);
  return { rows, base, bonus: total - base, total };
}
