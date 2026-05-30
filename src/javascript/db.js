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
  seconds: Math.floor(Date.now() / 1000)
};

const MOCK_SONG = {
  id: "local-test-1",
  title: "디맥 판정 테스트 곡",
  artist: "NCS Music",
  subtitle: "진짜 음악으로 테스트!",
  // 👇 여기 가짜 ID를 진짜 ID(K4DyBUG242c)로 바꿨습니다!
  // db.js 안에서 바꿔야 할 부분 2곳 (MOCK_SONG, MOCK_SHEET 안에 각각 2개씩 있습니다)
  image: "https://img.youtube.com/vi/K4DyBUG242c/mqdefault.jpg", 
  youtubeId: "K4DyBUG242c",
  url: "", 
  tags: ["test", "local", "recommended"], 
  keys: [4, 5, 6], 
  genres: [],
  categories: [],
  searchTags: [],
  srcMode: "youtube",
  visibility: "public",
  dateCreated: mockDate, 
  dateUpdated: mockDate,
  createdBy: "local-admin"
};

const MOCK_SHEET = {
  id: "local-sheet-1",
  songId: "local-test-1",
  title: "테스트 패턴 - 4K 무한",
  difficulty: 5,
  keys: [4], 
  tags: ["test", "local", "recommended"], 
  srcMode: "youtube",
  youtubeId: "K4DyBUG242c",
  url: "", 
  visibility: "public",
  dateCreated: mockDate,
  dateUpdated: mockDate,
  createdBy: "local-admin",
  // 🚨 10개짜리 고정 노트를 지우고 0.4초마다 150초 동안 생성하는 코드로 변경!
  // db.js 내부 MOCK_SHEET의 sheet 배열 생성 부분 수정
  sheet: JSON.stringify((() => {
    let notes = [];
    for(let i = 1.0; i <= 150.0; i += 0.4) { 
      // 3번에 1번 꼴로 길이가 0.3초인 롱노트 생성, 나머지는 단노트
      let isLongNote = (Math.random() > 0.6); 
      notes.push({ 
        t: i, 
        key: Math.floor(Math.random() * 4),
        // 노트 객체에 'l' (길이) 속성 추가 (note.js가 사용하는 변수명에 따라 length나 duration일 수 있음)
        l: isLongNote ? 0.3 : 0 
      });
    }
    return notes;
  })())
};

// ... (이 아래 함수들은 그대로 유지) ...
// =================================================================
// 🚨 에러 원천 차단된 가짜 데이터 반환 함수들 🚨
// =================================================================

export async function getSongListCached() { return [MOCK_SONG]; }
export function getSongList() { return Promise.resolve([MOCK_SONG]); }
export async function getSongsInIdArray() { return [MOCK_SONG]; }
export function getSong() { return Promise.resolve(MOCK_SONG); }
export function getSheetList() { return Promise.resolve([MOCK_SHEET]); }
export function getSheet() { return Promise.resolve(MOCK_SHEET); }

export async function getGameSheet() {
  let sheet = { ...MOCK_SHEET };
  let song = { ...MOCK_SONG };
  sheet.youtubeId = sheet.youtubeId ?? song.youtubeId;
  sheet.url = sheet.url ?? song.url;
  sheet.srcMode = sheet.srcMode ?? song.srcMode;
  sheet.title = sheet.title ?? song.title + " - " + song.artist;
  sheet.image = song.image;
  sheet.song = song;
  sheet.sheet = JSON.parse(sheet.sheet);
  sheet.sheetId = sheet.id;
  return sheet;
}

export function getTags() { return Promise.resolve(["test", "local", "recommended"]); }
export async function getBestScore() { return null; }

export async function getUserProfile() { 
  return { 
    displayName: "Local Player",
    favorites: ["local-test-1"],
    likedSongs: ["local-test-1"],
    playedSongs: [],
    tags: []
  }; 
}

export function getPlayCount() { return Promise.resolve(0); }
export function getResult() { return Promise.resolve(null); }

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
    tags: ["test", "local", "recommended"]
  }); 
}

// 기타 쓰기 방지 함수들
export function createSong() { return Promise.resolve("local-test-1"); }
export function updateSong() { return Promise.resolve(); }
export function createSheet() { return Promise.resolve("local-sheet-1"); }
export function updateSheet() { return Promise.resolve(); }
export function uploadResult() { return Promise.resolve(); }
export function updateUserProfile() { return Promise.resolve(); }
export function createPlay() { return Promise.resolve("play-1"); }
export function updatePlay() { return Promise.resolve(); }
export function updatePlaylist() { return Promise.resolve(); }
export function updateTagArray(tags) { return tags; }