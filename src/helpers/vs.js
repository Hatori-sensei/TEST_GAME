// [LAN 대전] 대전 방 API 래퍼. 호스트 서버(electron/lan-server.js)의 /room/* 를 호출한다.
// 대전 흐름: 로비(입장/곡 선택/준비) → 방장 START → 각 PC 게임 화면 로딩 → loaded 보고
//          → 호스트가 startAt(호스트 시각) 방송 → 각 PC가 시계 차이로 환산해 동시에 시작
//          → 250ms마다 점수 보고/상대 점수 수신 → finish 보고 → 대전 결과

import { lanRequest, getPcId, subscribeLan } from "./lan";

const post = (action, body = {}, timeoutMs = 2500) => lanRequest("POST", `/room/${action}`, { pcId: getPcId(), ...body }, timeoutMs);

export const vsJoin = (name, group) => post("join", { name, group });
export const vsLeave = () => post("leave");
export const vsPing = () => post("ping", {}, 1500);
export const vsSelect = (sheetId) => post("select", { sheetId });
export const vsReady = (ready) => post("ready", { ready });
export const vsStart = () => post("start");
export const vsLoaded = () => post("loaded");
export const vsReset = () => post("reset");
export const vsProgress = (live) => post("progress", live, 1000);
export const vsFinish = (final) => post("finish", { final }, 3000);

export async function vsRoom() {
  const r = await lanRequest("GET", "/room", undefined, 2000);
  return r.ok ? r.data : null;
}

// 호스트가 시작 시각(startAt, 호스트 시계 기준 ms)을 정할 때까지 기다림.
// 방송(SSE)으로 받고, 방송이 끊겨도 1초마다 직접 확인. timeoutMs 지나면 null
export function waitForStartAt(timeoutMs = 25000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      off();
      resolve(v);
    };
    const check = (room) => {
      if (room && room.startAt > 0 && (room.phase === "countdown" || room.phase === "playing")) finish(room.startAt);
    };
    const off = subscribeLan((event, data) => {
      if (event === "room") check(data);
    });
    const poll = setInterval(async () => check(await vsRoom()), 1000);
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}
