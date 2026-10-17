import { resolveMediaUrl } from "../utils/pathResolver";

function createDateStub() {
  return {
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    seconds: Math.floor(Date.now() / 1000),
  };
}

function parseLengthToSec(length) {
  if (typeof length === "number" && Number.isFinite(length)) return length;
  if (typeof length === "string") {
    const [mm, ss] = length.split(":").map(Number);
    if (Number.isFinite(mm) && Number.isFinite(ss)) return mm * 60 + ss;
  }
  return 60;
}

export function createSongTemplate(overrides = {}) {
  return {
    id: "local-song",
    title: "New Local Song",
    artist: "Local Artist",
    subtitle: "",
    image: "",
    audioPath: "songs/local-song.mp3",
    bgaPath: "videos/local-song.mp4",
    tags: ["local"],
    keys: [4],
    genres: [],
    categories: [],
    searchTags: [],
    visibility: "public",
    dateCreated: createDateStub(),
    dateUpdated: createDateStub(),
    createdBy: "local-admin",
    length: 60,
    previewStartSec: 0,
    previewEndSec: 60,
    ...overrides,
  };
}

export function createChartTemplate(overrides = {}) {
  return {
    id: "local-sheet",
    songId: "local-song",
    title: "New Local Chart",
    difficulty: 4,
    keys: [4],
    tags: ["local"],
    visibility: "public",
    dateCreated: createDateStub(),
    dateUpdated: createDateStub(),
    createdBy: "local-admin",
    sheet: JSON.stringify([]),
    sheetFile: "",
    ...overrides,
  };
}

export async function fetchChartFile(sheetFile) {
  const url = resolveMediaUrl(`charts/${sheetFile}`);
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} (${url})`);

  const parsed = await response.json();
  const notes = Array.isArray(parsed) ? parsed : parsed?.notes;
  if (!Array.isArray(notes)) {
    throw new Error("notes 배열이 없습니다");
  }

  return {
    notes,
    gimmicks: Array.isArray(parsed?.gimmicks) ? parsed.gimmicks : [],
  };
}

// ---------------------------------------------------------------------------
// [외부 곡 폴더] DJON-data/catalog.json
// exe 옆 DJON-data 폴더의 catalog.json에 적힌 곡·차트를 내장 목록 "뒤에 더한다".
// 같은 id면 catalog.json 쪽이 내장 항목을 덮어쓴다. 파일이 없으면 내장 목록만 쓴다.
//   { "version": 1, "songs": [ {곡}, ... ], "charts": [ {차트}, ... ], "hiddenRules": [ ... ] }
//   곡:   id, title, audioPath 필수. 나머지는 createSongTemplate 필드와 같다.
//         영상·표지가 없으면 bgaPath / customCoverUrl을 null로(빼면 템플릿 기본 경로가 들어감)
//         "hidden": true 이면 히든곡(일반 목록에서 빠지고 Arcade 히든 규칙으로만 등장)
//   차트: id, songId, sheetFile 필수. 나머지는 createChartTemplate 필드와 같다.
//   hiddenRules: [{ id, picks: [1번째 차트 id, 2번째 차트 id], minAccuracy, hiddenChartId }]
// 곡 id는 영문자를 하나 이상 포함해야 함(숫자로만 된 id는 객체 키 정렬 때문에 목록 맨 앞으로 감).
// main.js가 앱을 띄우기 전에 loadCatalog()를 한 번 부른다. 형식은 차트매니저와 공유하므로
// 바꿀 때는 매니저 쪽(src/core/game/catalogFormat.js)도 맞춰야 한다.
// ---------------------------------------------------------------------------

// 히든곡: 일반 목록(localCatalog.songs/charts)에 넣지 않고 id로만 찾는다
export const HIDDEN_SONGS = {};
export const HIDDEN_CHARTS = {};
// 히든 규칙 기본값(코드). catalog.json에 hiddenRules가 있으면 그걸로 바뀐다
export const HIDDEN_RULES = [];
let hiddenRules = HIDDEN_RULES;
export function getHiddenRules() {
  return hiddenRules;
}

// 불러오기 결과(모드 선택 화면/설정에 표시). hash = PC끼리 곡 목록·채보가 같은지 비교용 코드
export const catalogStatus = {
  loaded: false, // catalog.json을 읽었는지
  external: 0, // catalog.json에서 추가/교체한 곡 수
  hidden: 0, // 히든곡 수
  error: "", // catalog.json을 읽지 못한 이유
  warnings: [], // 건너뛴 항목 등
  missing: [], // 없는 파일 [{ id, path, required }]
  hash: "",
};

const HAS_LETTER = /[A-Za-z]/;

export async function loadCatalog() {
  const url = resolveMediaUrl("catalog.json");
  let data = null;
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    // 데이터 폴더나 catalog.json이 없음: 내장 목록만 사용
    // (개발 서버는 없는 파일에 index.html을 돌려주므로 JSON이 아니면 없는 것으로 본다)
    const isJson = (response.headers.get("content-type") || "").includes("json");
    if (response.status === 404 || (response.ok && !isJson)) {
      data = null;
    } else if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${url})`);
    } else {
      data = await response.json();
    }
  } catch (error) {
    console.error("[catalog] catalog.json을 읽을 수 없어 내장 곡 목록만 사용합니다.", error);
    catalogStatus.error = `catalog.json 오류: ${error && error.message ? error.message : error}`;
    data = null;
  }
  if (data) {
    applyCatalog(data);
    catalogStatus.loaded = true;
    await checkMissingFiles(data);
  }
  catalogStatus.hash = await computeCatalogHash();
}

function warn(message, entry) {
  console.warn(`[catalog] ${message}`, entry);
  catalogStatus.warnings.push(message);
}

export function applyCatalog(data) {
  const songs = Array.isArray(data?.songs) ? data.songs : [];
  const charts = Array.isArray(data?.charts) ? data.charts : [];

  for (const entry of songs) {
    if (!entry?.id || !entry.title || !entry.audioPath) {
      warn("id/title/audioPath가 없는 곡을 건너뜁니다.", entry);
      continue;
    }
    if (!HAS_LETTER.test(String(entry.id))) {
      warn(`곡 id "${entry.id}"에 영문자가 없어 건너뜁니다(예: song-17).`, entry);
      continue;
    }
    const song = createSongTemplate({ ...entry, bgaPath: entry.bgaPath ?? null });
    if (entry.hidden === true) {
      delete localCatalog.songs[entry.id];
      HIDDEN_SONGS[entry.id] = song;
      catalogStatus.hidden += 1;
    } else {
      delete HIDDEN_SONGS[entry.id];
      localCatalog.songs[entry.id] = song;
    }
    catalogStatus.external += 1;
  }

  for (const entry of charts) {
    if (!entry?.id || !entry.songId || !entry.sheetFile) {
      warn("id/songId/sheetFile이 없는 차트를 건너뜁니다.", entry);
      continue;
    }
    if (!getSongById(entry.songId)) {
      warn(`곡 "${entry.songId}"이 없어 차트를 건너뜁니다.`, entry);
      continue;
    }
    const chart = createChartTemplate(entry);
    if (entry.hidden === true || HIDDEN_SONGS[entry.songId]) {
      delete localCatalog.charts[entry.id];
      HIDDEN_CHARTS[entry.id] = chart;
    } else {
      delete HIDDEN_CHARTS[entry.id];
      localCatalog.charts[entry.id] = chart;
    }
  }

  // 히든으로 바뀐 내장 곡의 차트도 일반 목록에서 뺀다
  Object.values(localCatalog.charts).forEach((chart) => {
    if (HIDDEN_SONGS[chart.songId]) {
      delete localCatalog.charts[chart.id];
      HIDDEN_CHARTS[chart.id] = chart;
    }
  });

  if (Array.isArray(data?.hiddenRules)) {
    hiddenRules = data.hiddenRules.filter((rule) => {
      const ok =
        !!rule &&
        !!rule.id &&
        Array.isArray(rule.picks) &&
        rule.picks.length === 2 &&
        rule.picks.every((id) => getChartById(id)) &&
        !!getChartById(rule.hiddenChartId);
      if (!ok) warn("잘못된 히든 규칙을 건너뜁니다(picks 2개와 hiddenChartId가 실제 차트여야 함).", rule);
      return ok;
    });
  }
}

// 외부 곡의 필수 파일(음원·채보)과 선택 파일(영상·표지)이 실제로 있는지 확인.
// 1바이트만 요청(Range)해서 로컬 파일이면 빠르다. 실패해도 게임은 계속 뜬다.
async function checkMissingFiles(data) {
  const targets = [];
  (Array.isArray(data?.songs) ? data.songs : []).forEach((s) => {
    if (!s || !s.id) return;
    if (s.audioPath) targets.push({ id: s.id, path: s.audioPath, required: true });
    if (s.bgaPath) targets.push({ id: s.id, path: s.bgaPath, required: false });
    if (s.customCoverUrl) targets.push({ id: s.id, path: s.customCoverUrl, required: false });
  });
  (Array.isArray(data?.charts) ? data.charts : []).forEach((c) => {
    if (c && c.id && c.sheetFile) targets.push({ id: c.id, path: `charts/${c.sheetFile}`, required: true });
  });
  await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(resolveMediaUrl(t.path), { headers: { Range: "bytes=0-0" }, cache: "no-store" });
        const type = res.headers.get("content-type") || "";
        // 개발 서버는 없는 파일에 index.html(200)을 돌려줌 → html이면 없는 것으로 봄
        if (!res.ok || type.includes("text/html")) catalogStatus.missing.push(t);
      } catch (e) {
        catalogStatus.missing.push(t);
      }
    })
  );
  if (catalogStatus.missing.length) console.warn("[catalog] 없는 파일", catalogStatus.missing);

  // 필수 파일(음원·채보)이 없는 곡/차트는 목록에서 뺀다(축제 중에 고르면 재생이 안 되므로).
  // 내장 파일로 대체되는 경우는 위 검사에서 이미 "있음"으로 나온다.
  const required = catalogStatus.missing.filter((m) => m.required);
  const missingChart = new Set(required.filter((m) => m.path.startsWith("charts/")).map((m) => m.id));
  const affectedSongs = new Set(required.filter((m) => !m.path.startsWith("charts/")).map((m) => m.id));
  const missingAudio = new Set(affectedSongs);
  [localCatalog.charts, HIDDEN_CHARTS].forEach((map) => {
    Object.values(map).forEach((chart) => {
      if (missingChart.has(chart.id) || missingAudio.has(chart.songId)) {
        delete map[chart.id];
        affectedSongs.add(chart.songId);
      }
    });
  });
  const hasChart = (songId) =>
    [localCatalog.charts, HIDDEN_CHARTS].some((map) => Object.values(map).some((c) => c.songId === songId));
  affectedSongs.forEach((id) => {
    if (!missingAudio.has(id) && hasChart(id)) return; // 다른 차트가 남아 있으면 곡은 유지
    if (localCatalog.songs[id] || HIDDEN_SONGS[id]) {
      delete localCatalog.songs[id];
      delete HIDDEN_SONGS[id];
      catalogStatus.warnings.push(`필수 파일이 없어 "${id}"을(를) 곡 목록에서 뺐습니다.`);
    }
  });
}

// FNV-1a 32비트(간단한 비교용, 보안용 아님)
function fnv1a(text, hash = 0x811c9dc5) {
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// PC끼리 곡 목록이 같은지 보는 짧은 코드. 곡/차트 id·음원 경로·난이도와 채보 파일 내용으로 만든다.
// (음원·영상 내용은 크기 때문에 넣지 않음)
async function computeCatalogHash() {
  const songs = { ...localCatalog.songs, ...HIDDEN_SONGS };
  const charts = { ...localCatalog.charts, ...HIDDEN_CHARTS };
  let hash = fnv1a(
    Object.keys(songs)
      .sort()
      .map((id) => `${id}|${songs[id].audioPath}|${HIDDEN_SONGS[id] ? 1 : 0}`)
      .join(";")
  );
  const chartIds = Object.keys(charts).sort();
  for (const id of chartIds) {
    const c = charts[id];
    hash = fnv1a(`${id}|${c.songId}|${c.difficulty}|${c.sheetFile}`, hash);
    if (c.sheetFile) {
      try {
        const res = await fetch(resolveMediaUrl(`charts/${c.sheetFile}`), { cache: "no-store" });
        hash = fnv1a(res.ok ? await res.text() : "missing", hash);
      } catch (e) {
        hash = fnv1a("missing", hash);
      }
    }
  }
  return hash.toString(16).padStart(8, "0").slice(0, 6).toUpperCase();
}

function createNoteSequence(durationSec = 60, stepSec = 0.4) {
  const notes = [];
  for (let time = 1.0; time <= durationSec; time += stepSec) {
    const isLongNote = Math.random() > 0.7;
    notes.push({
      t: Number(time.toFixed(3)),
      key: Math.floor(Math.random() * 4),
      l: isLongNote ? 0.3 : 0,
    });
  }
  return notes;
}

export const localCatalog = {
  songs: {
    kamui: createSongTemplate({
      id: "kamui",
      title: "kamui",
      artist: "TJ.hangneil",
      subtitle: "TJ.hangneil",
      customCoverUrl: "/assets/covers/kamui.webp",
      audioPath: "songs/kamui.mp3",
      bgaPath: "videos/kamui.mp4",
      tags: ["local", "kamui", "bga"],
      keys: [4],
      searchTags: ["kamui", "local"],
      bpm: 210,
      length: "2:32",
      previewStartSec: 71,
      previewEndSec: 116,
    }),
    "knight-of-nights": createSongTemplate({
      id: "knight-of-nights",
      title: "초 나이트 오브 나이츠",
      artist: "BEATMARIO,MARON",
      subtitle: "BEATMARIO,MARON",
      customCoverUrl: "/assets/covers/knight-of-nights.jpg",
      audioPath: "songs/Knight-of-nights.mp3",
      bgaPath: "videos/Knight-of-nights.mp4",
      tags: ["local", "knight-of-nights", "bga"],
      keys: [4],
      searchTags: ["knight-of-nights", "local"],
      bpm: 193,
      length: "2:09",
      previewStartSec: 77,
      previewEndSec: 122,
    }),
    theEmpErroR: createSongTemplate({
      id: "theEmpErroR",
      title: "the EmpErroR",
      artist: "sasakure.UK",
      subtitle: "sasakure.UK",
      customCoverUrl: "/assets/covers/the-EmpErroR.jpg",
      audioPath: "songs/the-EmpErroR.mp3",
      bgaPath: "videos/the-EmpErroR.mp4",
      tags: ["local", "theEmpErroR", "bga"],
      keys: [4],
      searchTags: ["theEmpErroR", "local"],
      bpm: 240,
      length: "2:08",
      previewStartSec: 81,
      previewEndSec: 126,
    }),
    Mammal: createSongTemplate({
      id: "Mammal",
      title: "Mammal",
      artist: "Teikyou",
      subtitle: "Teikyou",
      customCoverUrl: "/assets/covers/Mammal.jpg",
      audioPath: "songs/Mammal.mp3",
      bgaPath: "videos/Mammal.mp4",
      tags: ["local", "Mammal", "bga"],
      keys: [4],
      searchTags: ["Mammal", "local"],
      bpm: 190,
      length: "2:33",
      previewStartSec: 89,
      previewEndSec: 134,
    }),
    Doit: createSongTemplate({
      id: "Doit",
      title: "Do it",
      artist: "HOUSERULEZ",
      subtitle: "HOUSERULEZ",
      customCoverUrl: "/assets/covers/Doit.jpg",
      audioPath: "songs/Doit.mp3",
      bgaPath: "videos/Doit.mp4",
      tags: ["local", "Doit", "bga"],
      keys: [4],
      searchTags: ["Doit", "local"],
      bpm: 129,
      length: "2:21",
      previewStartSec: 105,
      previewEndSec: 150,
    }),
    Apollo: createSongTemplate({
      id: "Apollo",
      title: "Apollo",
      artist: "TJ.hangneil",
      subtitle: "TJ.hangneil",
      customCoverUrl: "/assets/covers/Apollo.png",
      audioPath: "songs/Apollo.mp3",
      bgaPath: "videos/Apollo.mp4",
      tags: ["local", "Apollo", "bga"],
      keys: [4],
      searchTags: ["Apollo", "local"],
      bpm: 339,
      length: "2:37",
      previewStartSec: 105,
      previewEndSec: 150,
    }),
  },
  charts: {
    "kamui-sheet-1": createChartTemplate({
      id: "kamui-sheet-1",
      songId: "kamui",
      title: "KAMUI Test Chart",
      difficulty: 13,
      tags: ["kamui", "local", "bga"],
      sheetFile: "kamui.json",
    }),
    "knight-of-nights-sheet-1": createChartTemplate({
      id: "knight-of-nights-sheet-1",
      songId: "knight-of-nights",
      title: "초 나이트 오브 나이츠 Test Chart",
      difficulty: 4,
      tags: ["knight-of-nights", "local", "bga"],
      sheetFile: "knight-of-nights.json",
    }),
    "theEmpErroR-sheet-1": createChartTemplate({
      id: "theEmpErroR-sheet-1",
      songId: "theEmpErroR",
      title: "sasakure.UK",
      difficulty: 4,
      tags: ["theEmpErroR", "local", "bga"],
      sheetFile: "the-EmpErroR.json",
    }),
    "Mammal-sheet-1": createChartTemplate({
      id: "Mammal-sheet-1",
      songId: "Mammal",
      title: "Teikyou",
      difficulty: 4,
      tags: ["Mammal", "local", "bga"],
      sheetFile: "Mammal.json",
    }),
    "Doit-sheet-1": createChartTemplate({
      id: "Doit-sheet-1",
      songId: "Doit",
      title: "Do it",
      difficulty: 4,
      tags: ["Doit", "local", "bga"],
      sheetFile: "Doit.json",
    }),
    "Apollo-sheet-1": createChartTemplate({
      id: "Apollo-sheet-1",
      songId: "Apollo",
      title: "Apollo",
      difficulty: 15,
      tags: ["Apollo", "local", "bga"],
      sheetFile: "Apollo.json",
    }),
  },
};

export function getSongListCatalog() {
  return Object.values(localCatalog.songs);
}
export function getSongById(songId) {
  if (!songId) return null;

  const byKey = localCatalog.songs[songId] ?? HIDDEN_SONGS[songId];
  if (byKey) return byKey;

  return (
    Object.values(localCatalog.songs).find((song) => song.id === songId) ?? null
  );
}

// [대기 화면] SAMPLE PLAY 전용 채보. localCatalog.charts에 넣지 않아서 곡 선택/랭킹/대전 목록엔
// 안 나오고, getChartById로만 불러온다.
export const DEMO_CHARTS = {
  "Doit-sample": createChartTemplate({
    id: "Doit-sample",
    songId: "Doit",
    title: "Do it (SAMPLE)",
    difficulty: 2,
    tags: ["Doit", "local", "bga", "demo"],
    sheetFile: "Doit.sample.json",
  }),
};

// [대기 화면] SAMPLE PLAY 재생 순서. 타이틀에서 방치될 때마다 다음 항목으로 넘어가고 끝나면 처음부터.
// - chartId: DEMO_CHARTS의 샘플 채보 또는 일반 채보 id(예: "kamui-sheet-1")
// - from(선택): 시작 위치(초). 없으면 곡 처음부터
// - lengthSec(선택): 이만큼만 보여주고 타이틀로. 없으면 곡 끝까지
// 다른 곡 추가 예: { chartId: "Apollo-sheet-1" }, { chartId: "kamui-sheet-1", from: 60, lengthSec: 40 }
export const DEMO_PLAYLIST = [{ chartId: "Doit-sample" }];

export function getChartById(chartId) {
  return localCatalog.charts[chartId] ?? HIDDEN_CHARTS[chartId] ?? DEMO_CHARTS[chartId] ?? null;
}

export function getChartForSong(songId) {
  return (
    Object.values(localCatalog.charts).find((chart) => chart.songId === songId) ??
    Object.values(HIDDEN_CHARTS).find((chart) => chart.songId === songId) ??
    null
  );
}

export function buildFallbackNotes(durationSec = 60, bpm = 120) {
  const beatSec = 60 / bpm;
  const notes = [];
  let time = 1.0;

  while (time <= durationSec - 0.1) {
    notes.push({
      t: Number(time.toFixed(3)),
      key: Math.floor(Math.random() * 4),
    });
    time += beatSec * (Math.random() < 0.6 ? 0.5 : 1.0);
  }

  return notes;
}

export function resolveChartNotes(song, chart) {
  const notes = Array.isArray(chart?.notes) ? chart.notes : [];
  if (notes.length > 0) return notes;
  return buildFallbackNotes(parseLengthToSec(song?.length), song?.bpm ?? 120);
}

export function resolveSongPreviewRange(song, maxDurationSec = 60) {
  const totalSec = parseLengthToSec(song?.length);

  let startSec = Number(song?.previewStartSec ?? song?.previewStart ?? 0);
  let endSec = Number(
    song?.previewEndSec ?? song?.previewEnd ?? startSec + maxDurationSec
  );

  if (!Number.isFinite(startSec) || startSec < 0) startSec = 0;
  if (!Number.isFinite(endSec) || endSec <= startSec) {
    endSec = startSec + maxDurationSec;
  }

  endSec = Math.min(endSec, totalSec);
  if (endSec - startSec > maxDurationSec) {
    endSec = startSec + maxDurationSec;
  }

  if (endSec <= startSec) {
    endSec = Math.min(totalSec, startSec + 10);
  }

  return {
    startSec,
    endSec,
    durationSec: Math.max(0, endSec - startSec),
  };
}

export function loadSongData(songId) {
  const song = getSongById(songId);
  if (!song) return null;

  const chart = getChartForSong(songId);
  const notes = resolveChartNotes(song, chart);

  return {
    song,
    chart,
    notes,
  };
}

export function createLocalCatalogData(dateStub = createDateStub()) {
  const songs = Object.fromEntries(
    Object.values(localCatalog.songs).map((song) => [
      song.id,
      {
        ...song,
        dateCreated: dateStub,
        dateUpdated: dateStub,
      },
    ])
  );

  const charts = Object.fromEntries(
    Object.values(localCatalog.charts).map((chart) => [
      chart.id,
      {
        ...chart,
        dateCreated: dateStub,
        dateUpdated: dateStub,
      },
    ])
  );

  return {
    songs,
    charts,
  };
}
