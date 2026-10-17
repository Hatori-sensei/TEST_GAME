// [모드] 한 사람(한 크레딧)의 플레이 세션: Free Play / Arcade / VS Match, 최대 3곡(판).
// - store.state.session에 메모리로만 둔다(Electron은 새로고침을 막음). 타이틀로 가면 지운다.
// - 곡마다의 점수(100만점)는 그대로 쓰고, Arcade 최종 점수만 finalScore.js에서 난이도 배율을 곱한다.
// - 히든곡: Arcade 1·2번째 곡이 규칙(picks)과 같고, 두 곡 모두 정확도가 minAccuracy 이상이며
//   게임오버가 아니면 3번째 곡이 hiddenChartId로 바뀐다. 규칙은 localCatalog getHiddenRules()
//   (DJON-data/catalog.json의 hiddenRules, 없으면 코드의 HIDDEN_RULES).

import { store } from "./store";
import { getChartById, getSongById, getHiddenRules } from "../javascript/localCatalog";

export const MAX_STAGES = 3;
export const MODES = { free: "free", arcade: "arcade", vs: "vs" };
export const MODE_LABELS = { free: "FREE PLAY", arcade: "ARCADE", vs: "VS MATCH" };

export function getSession() {
  return store.state.session;
}

export function hasSession() {
  return !!store.state.session;
}

export function sessionMode() {
  return store.state.session ? store.state.session.mode : null;
}

export function startSession(mode, player = null) {
  store.commit("setSession", {
    id: `s-${Date.now()}`,
    mode,
    maxStages: MAX_STAGES,
    player: player ? { name: player.name, group: player.group } : null,
    queue: [], // arcade: 미리 고른 3곡(차트 id)
    stages: [], // 끝난 곡/판
    hiddenRuleId: "", // 열린 히든 규칙
    hiddenRevealed: false, // "HIDDEN UNLOCKED" 안내를 보여줬는지
    finalSaved: false, // 최종 기록 등록 여부(중복 방지)
  });
}

export function clearSession() {
  if (store.state.session) store.commit("setSession", null);
}

// Arcade 3곡 확정(시작 전)
export function setArcadeQueue(sheetIds) {
  const s = store.state.session;
  if (!s) return;
  store.commit("setSession", { ...s, queue: sheetIds.slice(0, MAX_STAGES) });
}

export function currentStageNo() {
  const s = store.state.session;
  return s ? Math.min(s.stages.length + 1, s.maxStages) : 0;
}

export function isSessionDone() {
  const s = store.state.session;
  return !!s && s.stages.length >= s.maxStages;
}

function chartLevel(sheetId) {
  const c = getChartById(sheetId);
  return c ? Number(c.difficulty) || 0 : 0;
}

function chartTitle(sheetId) {
  const c = getChartById(sheetId);
  if (!c) return sheetId;
  const song = getSongById(c.songId);
  return (song && song.title) || c.title || sheetId;
}

// 끝난 곡(판) 1개 기록. 같은 곡이 두 번 들어오지 않도록 playId로 막는다.
export function recordStage(stage) {
  const s = store.state.session;
  if (!s || s.stages.length >= s.maxStages) return null;
  if (stage.playId && s.stages.some((x) => x.playId === stage.playId)) return null;
  const entry = {
    playId: stage.playId || `p-${Date.now()}`,
    sheetId: stage.sheetId,
    title: stage.title || chartTitle(stage.sheetId),
    level: stage.level != null ? stage.level : chartLevel(stage.sheetId),
    score: Math.max(0, Math.floor(Number(stage.score) || 0)),
    accuracy: Number(stage.accuracy) || 0,
    maxCombo: Number(stage.maxCombo) || 0,
    isFullCombo: !!stage.isFullCombo,
    failed: !!stage.failed,
    missions: Array.isArray(stage.missions) ? stage.missions : [],
    hidden: !!stage.hidden,
    autoPlay: !!stage.autoPlay,
    resultId: stage.resultId || "",
  };
  const stages = [...s.stages, entry];
  let next = { ...s, stages };
  // Arcade 2곡이 끝나면 히든 규칙 검사 → 3번째 곡 교체
  if (s.mode === MODES.arcade && stages.length === 2) {
    const rule = matchHiddenRule(s.queue, stages);
    if (rule) {
      const queue = [...s.queue];
      queue[2] = rule.hiddenChartId;
      next = { ...next, queue, hiddenRuleId: rule.id };
    }
  }
  store.commit("setSession", next);
  return entry;
}

// 조합(1·2번째 곡 순서 포함) + 성적(두 곡 모두 정확도 이상, 게임오버 없음)
export function matchHiddenRule(queue, stages) {
  const rules = getHiddenRules() || [];
  return (
    rules.find((r) => {
      if (!r || !Array.isArray(r.picks) || r.picks.length !== 2) return false;
      if (!getChartById(r.hiddenChartId)) return false;
      if (queue[0] !== r.picks[0] || queue[1] !== r.picks[1]) return false;
      const min = Number(r.minAccuracy) || 0;
      return stages.slice(0, 2).every((st) => !st.failed && st.accuracy >= min);
    }) || null
  );
}

export function markHiddenRevealed() {
  const s = store.state.session;
  if (s) store.commit("setSession", { ...s, hiddenRevealed: true });
}

export function markFinalSaved() {
  const s = store.state.session;
  if (s) store.commit("setSession", { ...s, finalSaved: true });
}

// 다음 화면. free: 곡 선택, arcade: 다음 곡 배속 설정, vs: 로비, 끝났으면 최종 결과
export function nextRoute() {
  const s = store.state.session;
  if (!s) return "/mode";
  if (s.stages.length >= s.maxStages) return "/final";
  if (s.mode === MODES.arcade) {
    const sheetId = s.queue[s.stages.length];
    return sheetId ? `/speed-setup/${sheetId}` : "/final";
  }
  if (s.mode === MODES.vs) return "/vs";
  return "/menu";
}

// 다음 곡이 방금 열린 히든곡인지(안내 표시용)
export function nextIsHidden() {
  const s = store.state.session;
  return !!s && s.mode === MODES.arcade && !!s.hiddenRuleId && s.stages.length === 2;
}
