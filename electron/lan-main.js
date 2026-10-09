// [LAN] 메인 프로세스 쪽 LAN 기능. 렌더러는 preload의 window.djonLan → IPC로만 호출한다.
// 왜 메인 프로세스에서 통신하나: 게임 화면은 app:// (보안 출처)라서 렌더러가 http://192.168.x.x 로
// 직접 fetch하면 Chromium이 mixed content로 막는다. Node(http)는 그런 제한이 없음.
//
// - 호스트: lan-server.js 실행 + UDP 41234 에서 "찾기" 요청에 응답
// - 참가: 호스트로 HTTP 요청 대행, SSE(/events) 구독 후 렌더러로 이벤트 전달(끊기면 자동 재연결)

const http = require("http");
const os = require("os");
const dgram = require("dgram");
const { createFestivalServer, DEFAULT_PORT } = require("./lan-server");

const DISCOVERY_PORT = 41234;
const DISCOVERY_MAGIC = "DJON_DISCOVER_V1";

// "192.168.0.10" / "192.168.0.10:41235" / "pc-name:41235" → { host, port } (이상하면 null)
function parseHost(addr) {
  const s = String(addr || "").trim();
  const m = /^([a-zA-Z0-9.-]{1,253})(?::(\d{1,5}))?$/.exec(s);
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : DEFAULT_PORT;
  if (!(port > 0 && port < 65536)) return null;
  return { host: m[1], port };
}

function getLocalIPs() {
  const out = [];
  Object.values(os.networkInterfaces()).forEach((list) => {
    (list || []).forEach((i) => {
      if (i.family === "IPv4" && !i.internal) out.push({ address: i.address, netmask: i.netmask });
    });
  });
  return out;
}

// 서브넷 브로드캐스트 주소(예: 192.168.0.255) 계산
function broadcastAddrs() {
  const set = new Set(["255.255.255.255"]);
  getLocalIPs().forEach(({ address, netmask }) => {
    const a = address.split(".").map(Number);
    const m = String(netmask || "255.255.255.0").split(".").map(Number);
    if (a.length === 4 && m.length === 4) set.add(a.map((v, i) => (v & m[i]) | (~m[i] & 255)).join("."));
  });
  return [...set];
}

// 호스트로 HTTP 요청(예외 대신 결과 객체 반환)
function request({ host: addr, method = "GET", path = "/", body, timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const target = parseHost(addr);
    if (!target || typeof path !== "string" || !path.startsWith("/") || !["GET", "POST"].includes(method)) {
      resolve({ ok: false, status: 0, error: "잘못된 주소" });
      return;
    }
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: target.host,
        port: target.port,
        method,
        path,
        timeout: timeoutMs,
        headers: payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch (e) {
            data = null;
          }
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ ok, status: res.statusCode, data, error: ok ? "" : (data && data.error) || `HTTP ${res.statusCode}` });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("시간 초과")));
    req.on("error", (e) => resolve({ ok: false, status: 0, error: e.message || "연결 실패" }));
    if (payload) req.write(payload);
    req.end();
  });
}

// SSE 구독(재연결 포함). onEvent(event, data)
function createSubscriber(onEvent) {
  let current = null;
  let target = "";
  let retryTimer = null;
  let stopped = true;

  function connect() {
    const t = parseHost(target);
    if (!t || stopped) return;
    const req = http.get({ host: t.host, port: t.port, path: "/events", headers: { Accept: "text/event-stream" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        scheduleRetry();
        return;
      }
      onEvent("_status", { connected: true, host: target });
      res.setEncoding("utf8");
      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = "message";
          const dataLines = [];
          block.split("\n").forEach((line) => {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          });
          if (!dataLines.length) continue;
          try {
            onEvent(event, JSON.parse(dataLines.join("\n")));
          } catch (e) {
            // 깨진 이벤트 무시
          }
        }
      });
      res.on("end", scheduleRetry);
      res.on("error", scheduleRetry);
    });
    req.on("error", scheduleRetry);
    current = req;
  }

  function scheduleRetry() {
    if (current) {
      current.destroy();
      current = null;
    }
    if (stopped) return;
    onEvent("_status", { connected: false, host: target });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 1500);
  }

  return {
    start(addr) {
      if (!stopped && addr === target) return;
      this.stop();
      target = addr;
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      if (current) {
        current.destroy();
        current = null;
      }
    },
  };
}

// UDP로 같은 망의 호스트 찾기
function discover(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const found = new Map();
    let sock;
    try {
      sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch (e) {
      resolve([]);
      return;
    }
    const finish = () => {
      try {
        sock.close();
      } catch (e) {
        // 무시
      }
      // 같은 호스트가 여러 주소(127.0.0.1 + 랜 IP)로 응답하면 랜 IP 하나만
      const byKey = new Map();
      found.forEach((v) => {
        const key = `${v.name}|${v.address.split(":")[1]}`;
        const prev = byKey.get(key);
        if (!prev || prev.address.startsWith("127.")) byKey.set(key, v);
      });
      resolve([...byKey.values()]);
    };
    sock.on("error", finish);
    sock.on("message", (msg, rinfo) => {
      try {
        const info = JSON.parse(msg.toString("utf8"));
        if (info && info.app === "djon" && info.port) {
          const address = `${rinfo.address}:${info.port}`;
          found.set(address, { address, name: String(info.name || "").slice(0, 30) });
        }
      } catch (e) {
        // 다른 프로그램 패킷 무시
      }
    });
    sock.bind(0, () => {
      try {
        sock.setBroadcast(true);
      } catch (e) {
        // 무시
      }
      const msg = Buffer.from(DISCOVERY_MAGIC);
      broadcastAddrs().forEach((addr) => sock.send(msg, DISCOVERY_PORT, addr, () => {}));
      // 같은 PC에서 호스트를 띄운 경우도 찾기
      sock.send(msg, DISCOVERY_PORT, "127.0.0.1", () => {});
      setTimeout(finish, timeoutMs);
    });
  });
}

// IPC 등록. getWindow()는 이벤트를 보낼 창
function registerLan({ ipcMain, app, getWindow, log = () => {} }) {
  let server = null;
  let responder = null;
  let hostName = "DJ@ON HOST";

  const sendToRenderer = (event, data) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("djon-lan:event", { event, data });
  };
  const subscriber = createSubscriber(sendToRenderer);

  function startResponder(port) {
    if (responder) return;
    responder = dgram.createSocket({ type: "udp4", reuseAddr: true });
    responder.on("error", (e) => {
      log("[lan] 찾기 응답 소켓 오류", e.message);
      try {
        responder.close();
      } catch (err) {
        // 무시
      }
      responder = null;
    });
    responder.on("message", (msg, rinfo) => {
      if (msg.toString("utf8") !== DISCOVERY_MAGIC) return;
      const reply = Buffer.from(JSON.stringify({ app: "djon", name: hostName, port }));
      responder.send(reply, rinfo.port, rinfo.address, () => {});
    });
    responder.bind(DISCOVERY_PORT);
  }

  async function startHost(opts = {}) {
    hostName = String(opts.name || hostName).slice(0, 30);
    if (!server) {
      server = createFestivalServer({ dataDir: app.getPath("userData"), name: hostName, version: app.getVersion(), log });
    }
    try {
      const port = await server.start();
      startResponder(port);
      return { ok: true, port, ips: getLocalIPs().map((i) => i.address) };
    } catch (e) {
      server = null;
      return { ok: false, error: e.code === "EADDRINUSE" ? "포트가 이미 사용 중이에요(다른 호스트 실행 중?)" : e.message };
    }
  }

  async function stopHost() {
    if (responder) {
      try {
        responder.close();
      } catch (e) {
        // 무시
      }
      responder = null;
    }
    if (server) {
      await server.stop();
      server = null;
    }
    return { ok: true };
  }

  ipcMain.handle("djon-lan:startHost", (_e, opts) => startHost(opts));
  ipcMain.handle("djon-lan:stopHost", () => stopHost());
  ipcMain.handle("djon-lan:status", () => ({
    hosting: !!(server && server.running),
    port: server ? server.port : DEFAULT_PORT,
    ips: getLocalIPs().map((i) => i.address),
  }));
  ipcMain.handle("djon-lan:discover", (_e, ms) => discover(Math.min(5000, Math.max(300, Number(ms) || 1200))));
  ipcMain.handle("djon-lan:request", (_e, opts) => request(opts || {}));
  ipcMain.handle("djon-lan:subscribe", (_e, addr) => {
    if (!parseHost(addr)) return { ok: false };
    subscriber.start(String(addr));
    return { ok: true };
  });
  ipcMain.handle("djon-lan:unsubscribe", () => {
    subscriber.stop();
    return { ok: true };
  });

  app.on("before-quit", () => {
    subscriber.stop();
    stopHost();
  });
}

module.exports = { registerLan, request, discover, createSubscriber, parseHost, getLocalIPs, DISCOVERY_PORT };
