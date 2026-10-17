// 축제 기록(랭킹) 저장소. localStorage에 버전 필드와 함께 저장한다.
// - [모드] Arcade 곡 기록(kind "song")과 3곡 최종 점수(kind "final")가 자동으로 쌓인다.
//   모드 없이 친 결과는 결과 화면에서 이름/소속을 입력해 등록한 것만 쌓인다.
// - 저장 실패/깨진 데이터는 빈 기록으로 취급해 게임은 계속 돈다.
// - LAN 호스트 연동(통합 랭킹)은 lan.js가 이 모듈의 형식을 그대로 주고받는다.

export const RECORDS_VERSION = 1;
const STORAGE_KEY = "djon.records";
const PROFILE_KEY = "djon.lastPlayer"; // 마지막으로 입력한 이름/소속(연속 플레이 편의)
const MAX_ENTRIES = 5000;
// [모드] Arcade 최종 기록(kind "final")의 점수 상한: 3곡 × 100만 × 최대 배율(1.6)을 넉넉히 덮음
export const FINAL_SCORE_MAX = 5000000;
export const NAME_MAX = 8;
export const GROUP_MAX = 10;
export const GUEST_GROUP = "GUEST";

function clampText(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

// 기록 1개 보정(잘못된 값은 버림)
// kind: "song"(곡 기록, 예전 기록 포함) | "final"(Arcade 3곡 최종 점수: total/base/bonus/songs)
export function sanitizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = clampText(raw.name, NAME_MAX);
  if (!name) return null;
  const score = Number(raw.score);
  if (!Number.isFinite(score)) return null;
  const kind = raw.kind === "final" ? "final" : "song";
  const sheetId = kind === "final" ? "final" : clampText(raw.sheetId, 80);
  if (!sheetId) return null;
  const ts = Number(raw.ts);
  const base = {
    id: clampText(raw.id, 64) || `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name,
    group: clampText(raw.group, GROUP_MAX) || GUEST_GROUP,
    sheetId,
    pc: clampText(raw.pc, 20),
    ts: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
  };
  if (kind === "final") {
    const songs = Array.isArray(raw.songs) ? raw.songs.slice(0, 3) : [];
    return {
      ...base,
      title: "FINAL",
      score: Math.max(0, Math.min(FINAL_SCORE_MAX, Math.floor(score))),
      base: Math.max(0, Math.min(3000000, Math.floor(Number(raw.base) || 0))),
      bonus: Math.max(0, Math.min(FINAL_SCORE_MAX, Math.floor(Number(raw.bonus) || 0))),
      songs: songs.map((s) => ({
        sheetId: clampText(s && s.sheetId, 80),
        title: clampText(s && s.title, 80),
        level: Math.max(0, Math.min(99, Math.floor(Number(s && s.level) || 0))),
        score: Math.max(0, Math.min(1000000, Math.floor(Number(s && s.score) || 0))),
      })),
      accuracy: 0,
      maxCombo: 0,
      isFullCombo: false,
      missions: [],
    };
  }
  return {
    ...base,
    title: clampText(raw.title, 80),
    score: Math.max(0, Math.min(1000000, Math.floor(score))),
    accuracy: Math.max(0, Math.min(100, Number(raw.accuracy) || 0)),
    maxCombo: Math.max(0, Math.floor(Number(raw.maxCombo) || 0)),
    isFullCombo: raw.isFullCombo === true,
    missions: Array.isArray(raw.missions) ? raw.missions.map((m) => clampText(m, 40)).filter(Boolean) : [],
  };
}

export function sanitizeEntries(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  list.forEach((r) => {
    const e = sanitizeEntry(r);
    if (e && !seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  });
  return out.slice(-MAX_ENTRIES);
}

function storage() {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

export function loadRecords() {
  const st = storage();
  if (!st) return [];
  try {
    const raw = JSON.parse(st.getItem(STORAGE_KEY) || "null");
    return sanitizeEntries(raw && Array.isArray(raw.entries) ? raw.entries : []);
  } catch (e) {
    return [];
  }
}

function saveRecords(entries) {
  const st = storage();
  if (!st) return;
  try {
    st.setItem(STORAGE_KEY, JSON.stringify({ version: RECORDS_VERSION, entries: entries.slice(-MAX_ENTRIES) }));
  } catch (e) {
    // 저장 실패 시 무시(게임 진행 우선)
  }
}

export function addRecord(raw) {
  const entry = sanitizeEntry(raw);
  if (!entry) return null;
  const entries = loadRecords();
  entries.push(entry);
  saveRecords(entries);
  return entry;
}

// 다른 출처(LAN 호스트 등)의 기록을 합침(id 기준 중복 제거)
export function mergeRecords(list) {
  const merged = sanitizeEntries([...loadRecords(), ...(Array.isArray(list) ? list : [])]);
  saveRecords(merged);
  return merged;
}

export function clearRecords() {
  saveRecords([]);
}

function isToday(ts, now = Date.now()) {
  const a = new Date(ts);
  const b = new Date(now);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 곡별 순위: 같은 사람(이름+소속)은 최고 기록 1개만
export function topBySheet(entries, sheetId, n = 10, { todayOnly = false } = {}) {
  const best = new Map();
  entries.forEach((e) => {
    if (e.kind === "final" || e.sheetId !== sheetId) return;
    if (todayOnly && !isToday(e.ts)) return;
    const key = `${e.name}\u0000${e.group}`;
    const prev = best.get(key);
    if (!prev || e.score > prev.score || (e.score === prev.score && e.ts < prev.ts)) best.set(key, e);
  });
  return [...best.values()].sort((a, b) => b.score - a.score || a.ts - b.ts).slice(0, n);
}

// [모드] Arcade 최종 점수 순위: 같은 사람(이름+소속)은 최고 기록 1개만
export function topFinals(entries, n = 10, { todayOnly = false } = {}) {
  const best = new Map();
  entries.forEach((e) => {
    if (e.kind !== "final") return;
    if (todayOnly && !isToday(e.ts)) return;
    const key = `${e.name}\u0000${e.group}`;
    const prev = best.get(key);
    if (!prev || e.score > prev.score || (e.score === prev.score && e.ts < prev.ts)) best.set(key, e);
  });
  return [...best.values()].sort((a, b) => b.score - a.score || a.ts - b.ts).slice(0, n);
}

// 이름별 미션 도장 개수(경품 확인용): 같은 미션은 1번만 셈
export function missionStamps(entries) {
  const people = new Map();
  entries.forEach((e) => {
    if (e.kind === "final") return;
    const key = `${e.name}\u0000${e.group}`;
    const p = people.get(key) || { name: e.name, group: e.group, stamps: new Set() };
    e.missions.forEach((m) => p.stamps.add(`${e.sheetId}:${m}`));
    people.set(key, p);
  });
  return [...people.values()]
    .map((p) => ({ name: p.name, group: p.group, stamps: p.stamps.size }))
    .filter((p) => p.stamps > 0)
    .sort((a, b) => b.stamps - a.stamps);
}

export function loadLastPlayer() {
  const st = storage();
  try {
    const p = JSON.parse((st && st.getItem(PROFILE_KEY)) || "null");
    return { name: clampText(p && p.name, NAME_MAX), group: clampText(p && p.group, GROUP_MAX) };
  } catch (e) {
    return { name: "", group: "" };
  }
}

export function saveLastPlayer(name, group) {
  const st = storage();
  try {
    if (st) st.setItem(PROFILE_KEY, JSON.stringify({ name: clampText(name, NAME_MAX), group: clampText(group, GROUP_MAX) }));
  } catch (e) {
    // 무시
  }
}
