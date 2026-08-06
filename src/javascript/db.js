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

const MOCK_SONG = {
  id: "local-test-1",
  title: "디맥 판정 테스트 곡",
  artist: "NCS Music",
  subtitle: "진짜 음악으로 테스트!",
  image: "",
  audioPath: "songs/local-test-1.mp3",
  bgaPath: "videos/song1.mp4",
  tags: ["test", "local", "recommended"],
  keys: [4, 5, 6],
  genres: [],
  categories: [],
  searchTags: [],
  visibility: "public",
  dateCreated: mockDate,
  dateUpdated: mockDate,
  createdBy: "local-admin",
  length: 60,
};

const MOCK_SONG_KAMUI = {
  id: "kamui",
  title: "KAMUI",
  artist: "Hatori Sensei",
  subtitle: "Local BGA Test",
  image: "",
  audioPath: "songs/kamui.mp3",
  bgaPath: "videos/kamui.mp4",
  tags: ["local", "kamui", "bga"],
  keys: [4],
  genres: [],
  categories: [],
  searchTags: ["kamui", "local"],
  visibility: "public",
  dateCreated: mockDate,
  dateUpdated: mockDate,
  createdBy: "local-admin",
  length: 24,
};

const MOCK_SONGS = {
  [MOCK_SONG.id]: MOCK_SONG,
  [MOCK_SONG_KAMUI.id]: MOCK_SONG_KAMUI,
};

const MOCK_SHEET = {
  id: "local-sheet-1",
  songId: "local-test-1",
  title: "테스트 패턴 - 4K 무한",
  difficulty: 5,
  keys: [4],
  tags: ["test", "local", "recommended"],
  visibility: "public",
  dateCreated: mockDate,
  dateUpdated: mockDate,
  createdBy: "local-admin",
  sheet: JSON.stringify(
    (() => {
      let notes = [];
      for (let i = 1.0; i <= 150.0; i += 0.4) {
        let isLongNote = Math.random() > 0.6;
        notes.push({
          t: i,
          key: Math.floor(Math.random() * 4),
          l: isLongNote ? 0.3 : 0,
        });
      }
      return notes;
    })()
  ),
};

const MOCK_SHEET_KAMUI = {
  id: "kamui-sheet-1",
  songId: "kamui",
  title: "KAMUI Test Chart",
  difficulty: 4,
  keys: [4],
  tags: ["kamui", "local", "bga"],
  visibility: "public",
  dateCreated: mockDate,
  dateUpdated: mockDate,
  createdBy: "local-admin",
  sheet: JSON.stringify([
    { startTime: 1.0, endTime: 1.6, key: 0 },
    { t: 2.4, key: 1 },
    { t: 3.2, key: 2, l: 0.5 },
    { t: 4.4, key: 3 },
  ]),
};

const MOCK_SHEETS = {
  [MOCK_SHEET.id]: MOCK_SHEET,
  [MOCK_SHEET_KAMUI.id]: MOCK_SHEET_KAMUI,
};

// ... (이 아래 함수들은 그대로 유지) ...
// =================================================================
// 🚨 에러 원천 차단된 가짜 데이터 반환 함수들 🚨
// =================================================================

export async function getSongListCached() {
  return Object.values(MOCK_SONGS);
}
export function getSongList() {
  return Promise.resolve(Object.values(MOCK_SONGS));
}
export async function getSongsInIdArray() {
  return Object.values(MOCK_SONGS);
}
export function getSong() {
  return Promise.resolve(MOCK_SONG);
}
export function getSheetList(songId) {
  const sheets = Object.values(MOCK_SHEETS).filter(
    (sheet) => sheet.songId === songId
  );
  return Promise.resolve(sheets.length ? sheets : [MOCK_SHEET]);
}
export function getSheet() {
  return Promise.resolve(MOCK_SHEET);
}

export async function getGameSheet(sheetId) {
  const sheet =
    Object.values(MOCK_SHEETS).find((item) => item.id === sheetId) ||
    MOCK_SHEET;
  const song = MOCK_SONGS[sheet.songId] || MOCK_SONG;
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
export function getResult() {
  return Promise.resolve(null);
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
export function uploadResult() {
  return Promise.resolve();
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
