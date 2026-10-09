// 미션(도장판). 결과 데이터만 보고 달성 여부를 계산한다 → 판정/점수 계산에는 영향 없음.
// 채보(localCatalog 차트)에 missions 배열이 있으면 그것을, 없으면 기본 미션 세트를 쓴다.
//   missions: [{ id: "fc", text: "FULL COMBO", type: "fullCombo" },
//              { id: "acc97", text: "정확도 97% 이상", type: "accuracyMin", value: 97 }, ...]
// type 목록: fullCombo / breakMax / accuracyMin / maxComboMin / scoreMin / perfectMin / longAll

import { getChartById } from "../javascript/localCatalog";

export const DEFAULT_MISSIONS = [
  { id: "fc", text: "FULL COMBO", type: "fullCombo" },
  { id: "break5", text: "BREAK 5개 이하", type: "breakMax", value: 5 },
  { id: "acc95", text: "정확도 95% 이상", type: "accuracyMin", value: 95 },
  { id: "long", text: "롱노트 전부 성공", type: "longAll" },
  { id: "combo300", text: "MAX COMBO 300 이상", type: "maxComboMin", value: 300 },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 미션 1개 달성 여부. 알 수 없는 type은 false
function check(m, r) {
  const breaks = num(r.judgeSummary && r.judgeSummary.break);
  switch (m.type) {
    case "fullCombo":
      return num(r.marks && r.marks.miss) === 0;
    case "breakMax":
      return breaks <= num(m.value);
    case "accuracyMin":
      return num(r.percentage) >= num(m.value);
    case "maxComboMin":
      return num(r.maxCombo) >= num(m.value);
    case "scoreMin":
      return num(r.score) >= num(m.value);
    case "perfectMin":
      return num(r.judgeSummary && r.judgeSummary.max100) >= num(m.value);
    case "longAll": {
      const ls = r.longStats;
      return !!ls && ls.cleared > 0 && ls.failed === 0;
    }
    default:
      return false;
  }
}

// 차트에 맞는 미션 목록(롱노트가 없는 차트면 longAll 미션은 뺌)
export function getMissions(sheetId, longStats) {
  const chart = getChartById(sheetId);
  const list = chart && Array.isArray(chart.missions) && chart.missions.length ? chart.missions : DEFAULT_MISSIONS;
  const hasLong = !longStats || longStats.cleared + longStats.failed > 0;
  return list.filter((m) => m && m.id && (m.type !== "longAll" || hasLong));
}

// 결과(LOCAL_RESULTS의 result 객체) → [{id, text, achieved}]
// 오토플레이 결과는 전부 미달성 처리
export function evaluateMissions(sheetId, r) {
  if (!r) return [];
  const missions = getMissions(sheetId, r.longStats);
  return missions.map((m) => ({
    id: String(m.id),
    text: m.text || String(m.id),
    achieved: r.autoPlay ? false : check(m, r),
  }));
}
