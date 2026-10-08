// [대기 화면] 축제 키오스크용 자동 진행.
// - 곡 선택/배속 설정/결과/게임오버 화면, 일시정지된 게임에서 IDLE_TO_TITLE_SEC 동안 입력이 없으면 타이틀로
// - 타이틀에서 TITLE_TO_DEMO_SEC 동안 입력이 없으면 SAMPLE PLAY(데모 채보 자동 연주) 시작
// - 랭킹 보드(/rankings), 대전 로비(/vs), 플레이 중인 게임은 건드리지 않음
// - 설정 attractMode를 끄면 전부 동작 안 함

import { loadSettings } from "./settings";
import { DEMO_CHART_ID } from "../javascript/localCatalog";

export const IDLE_TO_TITLE_SEC = 60; // 메뉴/결과 화면 방치 → 타이틀
export const TITLE_TO_DEMO_SEC = 10; // 타이틀 방치 → SAMPLE PLAY
export const DEMO_LENGTH_SEC = 42; // SAMPLE PLAY 길이(끝나면 타이틀로)

const RETURN_PREFIXES = ["/menu", "/speed-setup", "/result", "/game-over"];
const INPUT_EVENTS = ["keydown", "mousedown", "mousemove", "wheel", "touchstart"];

let lastInput = Date.now();
let timer = null;
let gameIdleCheck = null; // Game.vue가 "일시정지 상태로 방치 중인지" 알려주는 함수

const onInput = () => {
  lastInput = Date.now();
};

// Game.vue가 마운트될 때 등록, 해제 시 null
export function setGameIdleCheck(fn) {
  gameIdleCheck = typeof fn === "function" ? fn : null;
}

export function installAttract(router, store) {
  if (timer) return;
  INPUT_EVENTS.forEach((ev) => window.addEventListener(ev, onInput, { capture: true, passive: true }));
  lastInput = Date.now();
  timer = setInterval(() => {
    if (!loadSettings().attractMode) return;
    const path = router.currentRoute.path;
    const idleSec = (Date.now() - lastInput) / 1000;

    if (path === "/") {
      if (idleSec >= TITLE_TO_DEMO_SEC) {
        lastInput = Date.now();
        router.push({ path: `/game/${DEMO_CHART_ID}`, query: { demo: "1" } }).catch(() => {});
      }
      return;
    }

    const returnable =
      RETURN_PREFIXES.some((p) => path.startsWith(p)) || (path.startsWith("/game/") && gameIdleCheck && gameIdleCheck());
    if (returnable && idleSec >= IDLE_TO_TITLE_SEC) {
      lastInput = Date.now();
      // 곡 선택 미리듣기 등 재생 중인 소리 정리 후 타이틀로
      if (store.state.audio && typeof store.state.audio.stop === "function") store.state.audio.stop(true);
      router.push("/").catch(() => {});
    }
  }, 1000);
}

export function uninstallAttract() {
  INPUT_EVENTS.forEach((ev) => window.removeEventListener(ev, onInput, { capture: true }));
  clearInterval(timer);
  timer = null;
}
