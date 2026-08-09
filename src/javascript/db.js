import {
  firestore,
  songsCollection,
  sheetsCollection,
  usersCollection,
  functions,
  resultsCollection,
  tagsCollection,
  playsCollection,
  playlistsCollection,
} from "../helpers/firebaseConfig";
import { store } from "../helpers/store";
import { Validator } from "jsonschema";
import {
  localCatalog,
  createLocalCatalogData,
  getChartById,
  getChartForSong,
  getSongById,
  getSongListCatalog,
} from "./localCatalog";

const assetsBaseUrl = "https://assets.rhythm-plus.com/songs";
const v = new Validator();
const songSchema = require("../../public/schema/song.schema.json");

// =================================================================
// 🚨 로컬 테스트용 가짜 데이터 (모든 필터 에러 완벽 방어 버전) 🚨
// =================================================================

// =================================================================
// 🚨 로컬 테스트용 가짜 데이터 (진짜 재생되는 유튜브 영상 적용!) 🚨
// =================================================================

const mockDate = {
  toDate: () => new Date(),
  toMillis: () => Date.now(),
  seconds: Math.floor(Date.now() / 1000),
};

const { songs: localSongs, charts: localCharts } = createLocalCatalogData(mockDate);

const MOCK_SONGS = localSongs;
const MOCK_SHEETS = localCharts;

const LOCAL_RESULTS = {};

// ... (이 아래 함수들은 그대로 유지) ...
// =================================================================
// 🚨 에러 원천 차단된 가짜 데이터 반환 함수들 🚨
// =================================================================

export async function getSongListCached() {
  return Object.values(MOCK_SONGS);
}
export function getSongList() {
  return Promise.resolve(getSongListCatalog());
}
export async function getSongsInIdArray() {
  return getSongListCatalog();
}
export function getSong(songId = "local-test-1") {
  return Promise.resolve(getSongById(songId) || getSongListCatalog()[0] || null);
}
export function getSheetList(songId) {
  const sheets = Object.values(MOCK_SHEETS).filter(
    (sheet) => sheet.songId === songId
  );
  return Promise.resolve(sheets.length ? sheets : [MOCK_SHEETS["local-sheet-1"]]);
}
export function getSheet(sheetId = "local-sheet-1") {
  return Promise.resolve(MOCK_SHEETS[sheetId] || MOCK_SHEETS["local-sheet-1"] || null);
}

export async function getGameSheet(sheetId) {
  const sheet = getChartById(sheetId) || MOCK_SHEETS["local-sheet-1"];
  const song = getSongById(sheet.songId) || MOCK_SONGS["local-test-1"];
  const resultSheet = { ...sheet };
  resultSheet.audioPath = resultSheet.audioPath ?? song.audioPath;
  resultSheet.bgaPath = resultSheet.bgaPath ?? song.bgaPath;
  resultSheet.srcMode = resultSheet.srcMode ?? "local";
  resultSheet.title = resultSheet.title ?? song.title + " - " + song.artist;
  resultSheet.image = song.image;
  resultSheet.song = song;
  resultSheet.length = resultSheet.length ?? song.length;
  resultSheet.sheet = JSON.parse(resultSheet.sheet);
  resultSheet.sheetId = resultSheet.id;
  return resultSheet;
}

export function getTags() {
  return Promise.resolve(["test", "local", "recommended"]);
}
export async function getBestScore() {
  return null;
}

export async function getUserProfile() {
  return {
    displayName: "Local Player",
    favorites: ["local-test-1"],
    likedSongs: ["local-test-1"],
    playedSongs: [],
    tags: [],
  };
}

export function getPlayCount() {
  return Promise.resolve(0);
}
export function getResult(resultId) {
  return Promise.resolve(LOCAL_RESULTS[resultId] || null);
}

// 👇 여기가 방금 에러를 일으킨 주범을 완벽하게 고친 부분입니다!
export function getPlaylist() {
  return Promise.resolve({
    id: "recommended",
    title: "Local Playlist",
    songs: ["local-test-1"],
    songIds: ["local-test-1"],
    songList: ["local-test-1"],
    items: ["local-test-1"],
    list: ["local-test-1"],
    sheetIds: ["local-sheet-1"],
    tags: ["test", "local", "recommended"],
  });
}

// 기타 쓰기 방지 함수들
export function createSong() {
  return Promise.resolve("local-test-1");
}
export function updateSong() {
  return Promise.resolve();
}
export function createSheet() {
  return Promise.resolve("local-sheet-1");
}
export function updateSheet() {
  return Promise.resolve();
}
export function uploadResult(payload) {
  const accuracy = Number(payload?.result?.accuracy || 0);
  const percentage = Math.floor(accuracy * 100) / 100;
  const resultId = `local-result-${Date.now()}`;
  const uid = store?.state?.currentUser?.uid || "local-user";
  const score = Number(payload?.result?.score || 0);
  const rank =
    score >= 970000
      ? "S"
      : score >= 900000
      ? "A"
      : score >= 800000
      ? "B"
      : "C";

  LOCAL_RESULTS[resultId] = {
    resultId,
    uid,
    rank,
    isFullCombo: (payload?.result?.marks?.miss || 0) === 0,
    songId: payload.songId,
    sheetId: payload.sheetId,
    result: {
      ...payload.result,
      percentage,
    },
  };

  return Promise.resolve({
    data: {
      resultId,
    },
  });
}
export function updateUserProfile() {
  return Promise.resolve();
}
export function createPlay() {
  return Promise.resolve("play-1");
}
export function updatePlay() {
  return Promise.resolve();
}
export function updatePlaylist() {
  return Promise.resolve();
}
export function updateTagArray(tags) {
  return tags;
}
