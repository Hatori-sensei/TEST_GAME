// [LAN] 렌더러 쪽 LAN 연동(통합 랭킹 / 대전). 실제 통신은 Electron 메인 프로세스가 하고
// 여기서는 preload가 노출한 window.djonLan 만 호출한다(app:// 화면의 mixed content 제한 회피).
// - 설정 lanRole이 "off"(기본)이거나 window.djonLan이 없으면(브라우저 개발 모드) 모든 함수가
//   아무것도 하지 않음 → 기존 동작과 동일.
// - 호스트가 잠깐 꺼져 있어도 기록이 사라지지 않게, 못 보낸 기록은 outbox에 모았다가 다음에 보냄.

import { loadSettings } from "./settings";
import { sanitizeEntries } from "./records";

export const DEFAULT_LAN_PORT = 41235;
const OUTBOX_KEY = "djon.lan.outbox";
const PC_ID_KEY = "djon.pcId";
const OUTBOX_MAX = 500;

function api() {
  return (typeof window !== "undefined" && window.djonLan) || null;
}

export function isLanAvailable() {
  return !!api();
}

export function getLanConfig() {
  const s = loadSettings();
  return { role: s.lanRole, host: s.lanHost, pcName: s.pcName };
}

// 이 PC가 통신할 호스트 주소(LAN 미사용이면 null). 호스트 PC는 자기 서버(127.0.0.1)를 씀
export function hostAddress(cfg = getLanConfig()) {
  if (!api()) return null;
  if (cfg.role === "host") return `127.0.0.1:${DEFAULT_LAN_PORT}`;
  if (cfg.role === "client" && cfg.host) return cfg.host;
  return null;
}

export function isLanActive() {
  return !!hostAddress();
}

// 이 PC 고유 id(대전 방에서 PC 구분용). 처음 한 번 만들어 저장
export function getPcId() {
  try {
    let id = window.localStorage.getItem(PC_ID_KEY);
    if (!id) {
      id = `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(PC_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return "pc-unknown";
  }
}

// 호스트로 요청. 실패해도 예외 없이 { ok:false, error } 반환
export async function lanRequest(method, path, body, timeoutMs = 3000, addr = hostAddress()) {
  const a = api();
  if (!a || !addr) return { ok: false, status: 0, error: "LAN 사용 안 함" };
  try {
    return await a.request({ host: addr, method, path, body, timeoutMs });
  } catch (e) {
    return { ok: false, status: 0, error: e.message || "연결 실패" };
  }
}

// ---------------- 통합 랭킹 ----------------
function loadOutbox() {
  try {
    const list = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}
function saveOutbox(list) {
  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-OUTBOX_MAX)));
  } catch (e) {
    // 무시
  }
}
export function pendingCount() {
  return loadOutbox().length;
}

// 못 보낸 기록 다시 보내기(성공하면 outbox 비움)
export async function flushOutbox() {
  const list = loadOutbox();
  if (!list.length || !isLanActive()) return false;
  const r = await lanRequest("POST", "/records", { entries: list });
  if (r.ok) saveOutbox([]);
  return r.ok;
}

// 기록 등록 시 호스트에도 전송
export async function postSharedRecord(entry) {
  if (!entry || !isLanActive()) return false;
  saveOutbox([...loadOutbox(), entry]);
  return flushOutbox();
}

// 통합 기록 가져오기. LAN 미사용/실패면 null(호출 측이 이 PC 기록으로 폴백)
export async function fetchSharedRecords() {
  if (!isLanActive()) return null;
  await flushOutbox();
  const r = await lanRequest("GET", "/records", undefined, 4000);
  if (!r.ok || !r.data || !Array.isArray(r.data.entries)) return null;
  return sanitizeEntries(r.data.entries);
}

// 통합 기록 초기화(관리자). LAN 미사용이면 아무것도 안 함
export async function clearSharedRecords() {
  if (!isLanActive()) return false;
  saveOutbox([]);
  const r = await lanRequest("POST", "/records/clear", {});
  return r.ok;
}

// ---------------- 호스트 서버 시작/정지 ----------------
// 앱 시작 시, 설정 저장 시 호출. 역할이 host면 서버를 켜고 아니면 끔
export async function applyLanRole(cfg = getLanConfig()) {
  const a = api();
  if (!a) return { ok: false, error: "설치된 앱(exe)에서만 사용할 수 있어요" };
  if (cfg.role === "host") return a.startHost({ name: cfg.pcName || "DJ@ON HOST" });
  await a.stopHost();
  return { ok: true };
}

export async function lanStatus() {
  const a = api();
  return a ? a.status() : null;
}

export async function discoverHosts(ms = 1200) {
  const a = api();
  return a ? a.discover(ms) : [];
}

// 연결 확인: 호스트 정보 + 왕복 시간
export async function pingHost(addr = hostAddress()) {
  const t0 = performance.now();
  const r = await lanRequest("GET", "/info", undefined, 2000, addr);
  return r.ok ? { ok: true, name: r.data.name, records: r.data.records, rttMs: Math.round(performance.now() - t0) } : { ok: false, error: r.error };
}

// ---------------- 실시간 방송(SSE) ----------------
// 호스트 방송 구독. handler(event, data). 반환 함수 호출 시 해제
// (메인 프로세스 구독은 1개라서 여러 화면이 구독해도 마지막 해제 때만 끊음)
let subscribers = 0;
export function subscribeLan(handler) {
  const a = api();
  const addr = hostAddress();
  if (!a || !addr) return () => {};
  const off = a.onEvent(handler);
  subscribers += 1;
  a.subscribe(addr);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    off();
    subscribers -= 1;
    if (subscribers <= 0) {
      subscribers = 0;
      a.unsubscribe();
    }
  };
}

// 호스트 시계와 이 PC 시계 차이(ms) 측정: 왕복이 가장 짧았던 측정값 사용(NTP 방식 간이판)
// 반환: { offsetMs, rttMs } → 호스트 시각 ≈ Date.now() + offsetMs
export async function measureClockOffset(samples = 6) {
  let best = null;
  for (let i = 0; i < samples; i += 1) {
    const t0 = Date.now();
    const r = await lanRequest("GET", "/time", undefined, 1500);
    const t1 = Date.now();
    if (r.ok && r.data && Number.isFinite(r.data.t)) {
      const rtt = t1 - t0;
      const offset = r.data.t - (t0 + rtt / 2);
      if (!best || rtt < best.rttMs) best = { offsetMs: offset, rttMs: rtt };
    }
  }
  return best;
}
