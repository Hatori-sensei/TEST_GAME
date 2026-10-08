// [LAN] 축제 서버: "호스트" 역할 PC의 Electron 메인 프로세스에서 실행되는 작은 HTTP 서버.
// - 인터넷 없이 같은 공유기(같은 서브넷)의 PC끼리 통합 랭킹 / 대전 방을 공유한다.
// - Node 내장 모듈만 사용(외부 라이브러리 없음). Electron 없이 Node로 단독 실행/테스트 가능.
// - 기록은 dataDir/djon-festival-records.json 에 저장(앱을 껐다 켜도 유지).
//
// API (모두 JSON, CORS 허용)
//   GET  /info              서버 정보(이름/버전/시각)
//   GET  /time              서버 시각(ms) → 클라이언트 시계 차이 계산용
//   GET  /records           통합 기록 { entries }
//   POST /records           기록 1개 또는 여러 개 추가 { entry } | { entries }
//   POST /records/clear     통합 기록 전체 삭제(관리자)
//   GET  /events            SSE 방송(event: room / progress / records)
//   GET  /room              대전 방 상태
//   POST /room/join|leave|select|ready|start|loaded|progress|finish|reset|ping

const http = require("http");
const fs = require("fs");
const path = require("path");

const DEFAULT_PORT = 41235;
const MAX_BODY = 256 * 1024;
const MAX_RECORDS = 20000;
const MAX_PLAYERS = 4;
const OFFLINE_MS = 10000; // 이 시간 동안 소식이 없으면 OFFLINE 표시
const COUNTDOWN_MS = 3000; // 모두 로딩 완료 → 이만큼 뒤에 동시 시작
const LOAD_TIMEOUT_MS = 20000; // 로딩이 늦는 PC가 있어도 이 시간 뒤엔 시작
const PROGRESS_BROADCAST_MS = 200; // 점수 방송 최소 간격

function clampText(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

// 렌더러(records.js)와 같은 형식만 받음. 잘못된 항목은 버림
function sanitizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = clampText(raw.name, 8);
  const sheetId = clampText(raw.sheetId, 80);
  const score = Number(raw.score);
  if (!name || !sheetId || !Number.isFinite(score)) return null;
  const ts = Number(raw.ts);
  return {
    id: clampText(raw.id, 64) || `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    group: clampText(raw.group, 10) || "GUEST",
    sheetId,
    title: clampText(raw.title, 80),
    score: Math.max(0, Math.min(1000000, Math.floor(score))),
    accuracy: Math.max(0, Math.min(100, Number(raw.accuracy) || 0)),
    maxCombo: Math.max(0, Math.floor(Number(raw.maxCombo) || 0)),
    isFullCombo: raw.isFullCombo === true,
    missions: Array.isArray(raw.missions) ? raw.missions.slice(0, 20).map((m) => clampText(m, 40)).filter(Boolean) : [],
    pc: clampText(raw.pc, 20),
    ts: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
  };
}

function num(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function createFestivalServer({ dataDir, port = DEFAULT_PORT, name = "DJ@ON HOST", version = "", log = () => {} } = {}) {
  const recordsFile = dataDir ? path.join(dataDir, "djon-festival-records.json") : null;
  let records = [];
  const recordIds = new Set();
  let saveTimer = null;
  const clients = new Set(); // SSE 응답 객체들
  let server = null;
  let roomTimer = null;
  let progressDirty = false;
  let lastProgressBroadcast = 0;

  // ---------------- 기록 저장 ----------------
  function loadRecordsFile() {
    if (!recordsFile) return;
    try {
      const raw = JSON.parse(fs.readFileSync(recordsFile, "utf8"));
      const list = Array.isArray(raw && raw.entries) ? raw.entries : [];
      list.forEach((r) => {
        const e = sanitizeRecord(r);
        if (e && !recordIds.has(e.id)) {
          recordIds.add(e.id);
          records.push(e);
        }
      });
    } catch (e) {
      // 파일 없음/깨짐 → 빈 기록으로 시작(깨진 파일은 덮어쓰기 전에 백업)
      if (fs.existsSync(recordsFile)) {
        try {
          fs.copyFileSync(recordsFile, `${recordsFile}.broken-${Date.now()}`);
        } catch (err) {
          // 무시
        }
      }
    }
  }

  // 잦은 쓰기를 막기 위해 0.5초 모아서 저장. 임시 파일에 쓴 뒤 교체(쓰다 꺼져도 원본 보존)
  function scheduleSave() {
    if (!recordsFile || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      flushSave();
    }, 500);
  }
  function flushSave() {
    if (!recordsFile) return;
    try {
      fs.mkdirSync(path.dirname(recordsFile), { recursive: true });
      const tmp = `${recordsFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, entries: records }));
      fs.renameSync(tmp, recordsFile);
    } catch (e) {
      log("[lan] 기록 저장 실패", e.message);
    }
  }

  function addRecords(list) {
    let added = 0;
    list.forEach((r) => {
      const e = sanitizeRecord(r);
      if (!e || recordIds.has(e.id)) return;
      recordIds.add(e.id);
      records.push(e);
      added += 1;
    });
    if (records.length > MAX_RECORDS) {
      const removed = records.splice(0, records.length - MAX_RECORDS);
      removed.forEach((e) => recordIds.delete(e.id));
    }
    if (added > 0) {
      scheduleSave();
      broadcast("records", { count: records.length });
    }
    return added;
  }

  // ---------------- 대전 방 ----------------
  let room = null;
  function resetRoom() {
    room = { id: `room-${Date.now()}`, phase: "lobby", sheetId: "", leaderId: "", startAt: 0, loadDeadline: 0, players: {}, seq: 0 };
  }
  resetRoom();

  function roomSnapshot() {
    const now = Date.now();
    const players = Object.values(room.players)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        pcId: p.pcId,
        name: p.name,
        group: p.group,
        ready: p.ready,
        loaded: p.loaded,
        offline: now - p.lastSeen > OFFLINE_MS,
        live: p.live,
        final: p.final,
      }));
    return { id: room.id, phase: room.phase, sheetId: room.sheetId, leaderId: room.leaderId, startAt: room.startAt, serverTime: now, seq: room.seq, players };
  }

  function roomChanged() {
    room.seq += 1;
    broadcast("room", roomSnapshot());
  }

  function pickLeader() {
    if (room.players[room.leaderId]) return;
    const first = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    room.leaderId = first ? first.pcId : "";
  }

  function touch(pcId) {
    const p = room.players[pcId];
    if (p) p.lastSeen = Date.now();
    return p;
  }

  function beginCountdown() {
    room.phase = "countdown";
    room.startAt = Date.now() + COUNTDOWN_MS;
    roomChanged();
  }

  // 주기 점검: 로딩 타임아웃, 카운트다운 → 플레이, 끝난 판정, 점수 방송 묶음
  function tickRoom() {
    const now = Date.now();
    if (room.phase === "loading" && now >= room.loadDeadline) beginCountdown();
    if (room.phase === "countdown" && now >= room.startAt) {
      room.phase = "playing";
      roomChanged();
    }
    if (room.phase === "playing") {
      const active = Object.values(room.players).filter((p) => now - p.lastSeen <= OFFLINE_MS || p.final);
      if (active.length > 0 && active.every((p) => p.final)) {
        room.phase = "result";
        roomChanged();
      }
    }
    if (progressDirty && now - lastProgressBroadcast >= PROGRESS_BROADCAST_MS) {
      progressDirty = false;
      lastProgressBroadcast = now;
      broadcast("progress", {
        serverTime: now,
        players: Object.values(room.players).map((p) => ({ pcId: p.pcId, live: p.live, offline: now - p.lastSeen > OFFLINE_MS })),
      });
    }
  }

  const roomActions = {
    ping(body) {
      touch(body.pcId);
      return { ok: true };
    },
    join(body) {
      const pcId = clampText(body.pcId, 40);
      if (!pcId) return { status: 400, error: "pcId 필요" };
      const exists = room.players[pcId];
      if (!exists) {
        if (Object.keys(room.players).length >= MAX_PLAYERS) return { status: 409, error: "방이 가득 찼어요(최대 4명)" };
        if (room.phase !== "lobby" && room.phase !== "result") return { status: 409, error: "대전이 진행 중이에요" };
      }
      room.players[pcId] = {
        pcId,
        name: clampText(body.name, 8) || pcId.slice(0, 8),
        group: clampText(body.group, 10),
        ready: exists ? exists.ready : false,
        loaded: exists ? exists.loaded : false,
        joinedAt: exists ? exists.joinedAt : Date.now(),
        lastSeen: Date.now(),
        live: exists ? exists.live : null,
        final: exists ? exists.final : null,
      };
      pickLeader();
      roomChanged();
      return { ok: true };
    },
    leave(body) {
      if (!room.players[body.pcId]) return { ok: true };
      delete room.players[body.pcId];
      pickLeader();
      if (Object.keys(room.players).length === 0) resetRoom();
      roomChanged();
      return { ok: true };
    },
    select(body) {
      if (!touch(body.pcId)) return { status: 403, error: "방에 없는 PC" };
      if (body.pcId !== room.leaderId) return { status: 403, error: "방장만 곡을 고를 수 있어요" };
      if (room.phase !== "lobby" && room.phase !== "result") return { status: 409, error: "지금은 바꿀 수 없어요" };
      room.phase = "lobby";
      room.sheetId = clampText(body.sheetId, 80);
      Object.values(room.players).forEach((p) => {
        p.ready = false;
        p.final = null;
        p.live = null;
      });
      roomChanged();
      return { ok: true };
    },
    ready(body) {
      const p = touch(body.pcId);
      if (!p) return { status: 403, error: "방에 없는 PC" };
      if (room.phase !== "lobby") return { status: 409, error: "지금은 바꿀 수 없어요" };
      p.ready = body.ready !== false;
      roomChanged();
      return { ok: true };
    },
    start(body) {
      if (!touch(body.pcId)) return { status: 403, error: "방에 없는 PC" };
      if (body.pcId !== room.leaderId) return { status: 403, error: "방장만 시작할 수 있어요" };
      if (room.phase !== "lobby") return { status: 409, error: "이미 시작했어요" };
      if (!room.sheetId) return { status: 409, error: "곡을 먼저 골라주세요" };
      const players = Object.values(room.players);
      if (!players.every((p) => p.ready || p.pcId === room.leaderId)) return { status: 409, error: "아직 준비 안 된 사람이 있어요" };
      players.forEach((p) => {
        p.loaded = false;
        p.live = null;
        p.final = null;
      });
      room.phase = "loading";
      room.startAt = 0;
      room.loadDeadline = Date.now() + LOAD_TIMEOUT_MS;
      roomChanged();
      return { ok: true };
    },
    loaded(body) {
      const p = touch(body.pcId);
      if (!p) return { status: 403, error: "방에 없는 PC" };
      p.loaded = true;
      if (room.phase === "loading") {
        const now = Date.now();
        const waiting = Object.values(room.players).filter((x) => !x.loaded && now - x.lastSeen <= OFFLINE_MS);
        if (waiting.length === 0) beginCountdown();
        else roomChanged();
      }
      return { ok: true, startAt: room.startAt };
    },
    progress(body) {
      const p = touch(body.pcId);
      if (!p) return { status: 403, error: "방에 없는 PC" };
      p.live = {
        score: Math.floor(num(body.score, 0, 1000000, 0)),
        accuracy: num(body.accuracy, 0, 100, 0),
        combo: Math.floor(num(body.combo, 0, 1e7, 0)),
        health: num(body.health, 0, 100, 0),
        t: num(body.t, -10, 3600, 0),
      };
      progressDirty = true;
      return { ok: true };
    },
    finish(body) {
      const p = touch(body.pcId);
      if (!p) return { status: 403, error: "방에 없는 PC" };
      const f = body.final || {};
      p.final = {
        score: Math.floor(num(f.score, 0, 1000000, 0)),
        accuracy: num(f.accuracy, 0, 100, 0),
        maxCombo: Math.floor(num(f.maxCombo, 0, 1e7, 0)),
        isFullCombo: f.isFullCombo === true,
        failed: f.failed === true,
        breaks: Math.floor(num(f.breaks, 0, 1e6, 0)),
      };
      p.live = { score: p.final.score, accuracy: p.final.accuracy, combo: 0, health: p.live ? p.live.health : 0, t: p.live ? p.live.t : 0 };
      roomChanged();
      return { ok: true };
    },
    reset(body) {
      if (body.pcId !== room.leaderId) return { status: 403, error: "방장만 할 수 있어요" };
      room.phase = "lobby";
      room.startAt = 0;
      Object.values(room.players).forEach((p) => {
        p.ready = false;
        p.loaded = false;
        p.live = null;
        p.final = null;
      });
      roomChanged();
      return { ok: true };
    },
  };

  // ---------------- HTTP ----------------
  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach((res) => {
      try {
        res.write(payload);
      } catch (e) {
        clients.delete(res);
      }
    });
  }

  function send(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(body);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new Error("too large"));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }
    if (req.method === "GET") {
      if (p === "/info") return send(res, 200, { app: "djon", name, version, time: Date.now(), records: records.length });
      if (p === "/time") return send(res, 200, { t: Date.now() });
      if (p === "/records") return send(res, 200, { version: 1, entries: records });
      if (p === "/room") return send(res, 200, roomSnapshot());
      if (p === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(`retry: 1500\nevent: room\ndata: ${JSON.stringify(roomSnapshot())}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      return send(res, 404, { error: "not found" });
    }
    if (req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
      } catch (e) {
        return send(res, 400, { error: "잘못된 요청" });
      }
      if (p === "/records") {
        const list = Array.isArray(body.entries) ? body.entries : body.entry ? [body.entry] : [];
        return send(res, 200, { ok: true, added: addRecords(list), count: records.length });
      }
      if (p === "/records/clear") {
        records = [];
        recordIds.clear();
        scheduleSave();
        broadcast("records", { count: 0 });
        return send(res, 200, { ok: true });
      }
      const m = /^\/room\/([a-z]+)$/.exec(p);
      if (m && roomActions[m[1]]) {
        const out = roomActions[m[1]](body || {});
        if (out.status) return send(res, out.status, { error: out.error });
        return send(res, 200, out);
      }
      return send(res, 404, { error: "not found" });
    }
    return send(res, 405, { error: "method" });
  }

  return {
    get port() {
      return port;
    },
    get running() {
      return !!server;
    },
    start() {
      if (server) return Promise.resolve(port);
      loadRecordsFile();
      return new Promise((resolve, reject) => {
        const srv = http.createServer((req, res) => {
          handle(req, res).catch((e) => {
            log("[lan] 요청 처리 오류", e.message);
            try {
              send(res, 500, { error: "server" });
            } catch (err) {
              // 무시
            }
          });
        });
        srv.keepAliveTimeout = 5000;
        srv.once("error", reject);
        srv.listen(port, "0.0.0.0", () => {
          server = srv;
          port = srv.address().port;
          roomTimer = setInterval(tickRoom, 50);
          // SSE 연결 유지용 주석 줄(공유기/방화벽이 오래 조용한 연결을 끊는 것 방지)
          srv.keepAliveTick = setInterval(() => clients.forEach((r) => r.write(": ping\n\n")), 15000);
          resolve(port);
        });
      });
    },
    stop() {
      clearInterval(roomTimer);
      roomTimer = null;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        flushSave();
      }
      clients.forEach((r) => {
        try {
          r.end();
        } catch (e) {
          // 무시
        }
      });
      clients.clear();
      if (!server) return Promise.resolve();
      const srv = server;
      server = null;
      clearInterval(srv.keepAliveTick);
      return new Promise((resolve) => srv.close(() => resolve()));
    },
    // 테스트용
    _flush: flushSave,
  };
}

module.exports = { createFestivalServer, sanitizeRecord, DEFAULT_PORT };
