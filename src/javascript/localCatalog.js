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
    ...overrides,
  };
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
    "local-test-1": createSongTemplate({
      id: "local-test-1",
      title: "디맥 판정 테스트 곡",
      artist: "NCS Music",
      subtitle: "진짜 음악으로 테스트!",
      customCoverUrl: "/assets/covers/local-test-1.jpg",
      audioPath: "songs/local-test-1.mp3",
      bgaPath: "videos/song1.mp4",
      tags: ["test", "local", "recommended"],
      keys: [4, 5, 6],
      length: 60,
      previewStartSec: 8,
      previewEndSec: 58,
    }),
    kamui: createSongTemplate({
      id: "kamui",
      title: "kamui",
      artist: "TJ.hangneil",
      subtitle: "Local BGA Test",
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
      artist: "BeatMARIO,MARON",
      subtitle: "Local BGA Test",
      customCoverUrl: "/assets/covers/knight-of-nights.jpg",
      audioPath: "songs/knight-of-nights.mp3",
      bgaPath: "videos/knight-of-nights.mp4",
      tags: ["local", "knight-of-nights", "bga"],
      keys: [4],
      searchTags: ["knight-of-nights", "local"],
      bpm: 210,
      length: "2:32",
      previewStartSec: 77,
      previewEndSec: 122,
    }),
    "demo-song": createSongTemplate({
      id: "demo-song",
      title: "Demo Song",
      artist: "Local Artist",
      subtitle: "Template demo",
      customCoverUrl: "/assets/covers/demo-song.jpg",
      audioPath: "songs/demo-song.mp3",
      bgaPath: "videos/demo-song.mp4",
      tags: ["demo", "local"],
      keys: [4],
      searchTags: ["demo", "template"],
      length: 90,
      previewStartSec: 10,
      previewEndSec: 70,
    }),
  },
  charts: {
    "local-sheet-1": createChartTemplate({
      id: "local-sheet-1",
      songId: "local-test-1",
      title: "테스트 패턴 - 4K 무한",
      difficulty: 5,
      tags: ["test", "local", "recommended"],
      sheet: JSON.stringify(createNoteSequence(150, 0.4)),
    }),
    "kamui-sheet-1": createChartTemplate({
      id: "kamui-sheet-1",
      songId: "kamui",
      title: "KAMUI Test Chart",
      difficulty: 4,
      tags: ["kamui", "local", "bga"],
      sheet: JSON.stringify([
        { startTime: 1.0, endTime: 1.6, key: 0 },
        { t: 2.4, key: 1 },
        { t: 3.2, key: 2, l: 0.5 },
        { t: 4.4, key: 3 },
      ]),
    }),
    "knight-of-nights-sheet-1": createChartTemplate({
      id: "knight-of-nights-sheet-1",
      songId: "knight-of-nights",
      title: "초 나이트 오브 나이츠 Test Chart",
      difficulty: 4,
      tags: ["knight-of-nights", "local", "bga"],
      sheet: JSON.stringify([
        { startTime: 1.0, endTime: 1.6, key: 0 },
        { t: 2.4, key: 1 },
        { t: 3.2, key: 2, l: 0.5 },
        { t: 4.4, key: 3 },
      ]),
    }),
    "demo-chart": createChartTemplate({
      id: "demo-chart",
      songId: "demo-song",
      title: "Demo Chart",
      difficulty: 3,
      tags: ["demo", "local"],
      sheet: JSON.stringify(createNoteSequence(60, 0.5)),
    }),
  },
};

export function getSongListCatalog() {
  return Object.values(localCatalog.songs);
}

export function getSongById(songId) {
  return localCatalog.songs[songId] ?? null;
}

export function getChartById(chartId) {
  return localCatalog.charts[chartId] ?? null;
}

export function getChartForSong(songId) {
  return (
    Object.values(localCatalog.charts).find((chart) => chart.songId === songId) ??
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
