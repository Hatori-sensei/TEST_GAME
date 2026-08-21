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
      audioPath: "songs/knight-of-nights.mp3",
      bgaPath: "videos/knight-of-nights.mp4",
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
      customCoverUrl: "/assets/covers/mammal.jpg",
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
    "theEmpErroR-sheet-1": createChartTemplate({
      id: "theEmpErroR-sheet-1",
      songId: "theEmpErroR",
      title: "sasakure.UK",
      difficulty: 4,
      tags: ["theEmpErroR", "local", "bga"],
      sheet: JSON.stringify([
        { startTime: 1.0, endTime: 1.6, key: 0 },
        { t: 2.4, key: 1 },
        { t: 3.2, key: 2, l: 0.5 },
        { t: 4.4, key: 3 },
      ]),
      }),
    "Mammal-sheet-1": createChartTemplate({
      id: "Mammal-sheet-1",
      songId: "Mammal",
      title: "Teikyou",
      difficulty: 4,
      tags: ["Mammal", "local", "bga"],
      sheet: JSON.stringify([
        { startTime: 1.0, endTime: 1.6, key: 0 },
        { t: 2.4, key: 1 },
        { t: 3.2, key: 2, l: 0.5 },
        { t: 4.4, key: 3 },
      ]),
    }),
    "Doit-sheet-1": createChartTemplate({
      id: "Doit-sheet-1",
      songId: "Doit",
      title: "Do it",
      difficulty: 4,
      tags: ["Doit", "local", "bga"],
      sheet: JSON.stringify([
        { startTime: 1.0, endTime: 1.6, key: 0 },
        { t: 2.4, key: 1 },
        { t: 3.2, key: 2, l: 0.5 },
        { t: 4.4, key: 3 },
      ]),
    }),
    "Apollo-sheet-1": createChartTemplate({
      id: "Apollo-sheet-1",
      songId: "Apollo",
      title: "Apollo",
      difficulty: 15,
      tags: ["Apollo", "local", "bga"],
      sheet: JSON.stringify([
        { startTime: 1.0, endTime: 1.6, key: 0 },
        { t: 2.4, key: 1 },
        { t: 3.2, key: 2, l: 0.5 },
        { t: 4.4, key: 3 },
      ]),
    }),
  },
};

export function getSongListCatalog() {
  return Object.values(localCatalog.songs);
}

export function getSongById(songId) {
  if (!songId) return null;

  const byKey = localCatalog.songs[songId];
  if (byKey) return byKey;

  return (
    Object.values(localCatalog.songs).find((song) => song.id === songId) ?? null
  );
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
