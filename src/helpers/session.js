// [모드] 한 사람(한 크레딧)의 플레이 세션: Free Play / Arcade / VS Match, 최대 3곡(판).
// - store.state.session에 메모리로만 둔다(Electron은 새로고침을 막음). 타이틀로 가면 지운다.
// - 곡마다의 점수(100만점)는 그대로 쓰고, Arcade 최종 점수만 finalScore.js에서 난이도 배율을 곱한다.
// - 히든곡: Arcade 곡 고르기에서 1·2번째 곡을 규칙(picks)의 조합·순서대로 고르면 3번째 칸이
//   "???"로 바뀌고 그 칸은 hiddenChartId로 정해진다(성적 조건 없음). 규칙은 localCatalog
//   getHiddenRules() (DJON-data/catalog.json의 hiddenRules, 없으면 코드의 HIDDEN_RULES).

import { store } from "./store";
import { getChartById, getSongById, getHiddenRules } from "../javascript/localCatalog";
import { applyPalette, isPaletteId } from "./palette";
import { loadSettings } from "./settings";

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
    // [팔레트] Arcade 입장 때 손님이 고른 색(이 크레딧 동안만). 없으면 운영자 기본색
    palette: player && isPaletteId(player.palette) ? player.palette : "",
    queue: [], // arcade: 미리 고른 3곡(차트 id)
    stages: [], // 끝난 곡/판
    hiddenRuleId: "", // 열린 히든 규칙
    hiddenRevealed: false, // "HIDDEN UNLOCKED" 안내를 보여줬는지
    finalSaved: false, // 최종 기록 등록 여부(중복 방지)
  });
}

export function clearSession() {
  if (store.state.session) store.commit("setSession", null);
  restoreBasePalette();
}

// [팔레트] 화면 기본 강조색: 크레딧 색(있으면) → 운영자 기본색. 게임 화면을 떠날 때·크레딧 끝날 때 부른다
export function basePaletteId() {
  const s = store.state.session;
  return (s && isPaletteId(s.palette) && s.palette) || loadSettings().palette;
}

export function restoreBasePalette() {
  return applyPalette(basePaletteId());
}

// Arcade 3곡 확정(시작 전). 1·2번째 곡이 히든 규칙과 맞으면 3번째 곡은 히든곡으로 정해진다.
export function setArcadeQueue(sheetIds) {
  const s = store.state.session;
  if (!s) return;
  const queue = sheetIds.slice(0, MAX_STAGES);
  const rule = matchHiddenRule(queue);
  if (rule) queue[2] = rule.hiddenChartId;
  store.commit("setSession", { ...s, queue, hiddenRuleId: rule ? rule.id : "" });
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
  store.commit("setSession", { ...s, stages: [...s.stages, entry] });
  return entry;
}

// 1·2번째 곡(차트 id)이 규칙의 조합·순서와 같으면 그 규칙. 성적은 보지 않는다.
export function matchHiddenRule(picks) {
  const rules = getHiddenRules() || [];
  return (
    rules.find((r) => {
      if (!r || !Array.isArray(r.picks) || r.picks.length !== 2) return false;
      if (!getChartById(r.hiddenChartId)) return false;
      return picks[0] === r.picks[0] && picks[1] === r.picks[1];
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
