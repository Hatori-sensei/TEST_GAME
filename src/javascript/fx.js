// [연출 기믹] 채보 gimmicks 중 "화면 연출" 타입만 그리는 모듈. 판정/노트 위치와 무관.
// - 기존 speed/stop 기믹은 buildVisualTimeline이 처리하고, 여기 타입들은 그쪽에서 무시됨.
// - 판정선/기어의 위치·크기는 절대 바꾸지 않음(흔들기/회전/줌 같은 효과는 없음).
// - 매 프레임 객체를 새로 만들지 않도록, 곡 로드 때 정규화한 배열 + 인덱스 포인터만 사용.
//
// 지원 타입(시간 단위: 초, 채보 시간 기준 = 노트 time과 같은 기준)
//   flash    { time, duration=0.3, color="#ffffff", intensity=0.6 }  화면 섬광(점점 사라짐)
//   blackout { time, duration=1, color="#000000", intensity=0.9, fade=0.2 }  BGA 암전(기어는 보임)
//   tint     { time, duration=1, color="#ff4fa3", intensity=0.25, fade=0.15 }  기어 색조
//   pulse    { time, duration=2, color="#19d3ff", bpm=120, intensity=0.8 }  기어 양옆 글로우 맥동
//   beat     { time, duration=4, color="#ffffff", bpm=120, intensity=0.5 }  박자마다 판정선 주변 글로우

export const FX_TYPES = ["flash", "blackout", "tint", "pulse", "beat"];
const BACK_TYPES = { flash: true, blackout: true }; // 기어 배경보다 먼저(=BGA 위, 기어 아래)

const DEFAULTS = {
  flash: { duration: 0.3, color: "#ffffff", intensity: 0.6, fade: 0 },
  blackout: { duration: 1, color: "#000000", intensity: 0.9, fade: 0.2 },
  tint: { duration: 1, color: "#ff4fa3", intensity: 0.25, fade: 0.15 },
  pulse: { duration: 2, color: "#19d3ff", intensity: 0.8, fade: 0, bpm: 120 },
  beat: { duration: 4, color: "#ffffff", intensity: 0.5, fade: 0, bpm: 120 },
};

const MAX_INTENSITY = { flash: 0.8, blackout: 1, tint: 0.6, pulse: 1, beat: 1 }; // 눈부심 상한

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// 색 문자열은 #rgb / #rrggbb / rgb()/rgba() / 이름만 허용(이상한 값이면 기본색)
function safeColor(v, def) {
  if (typeof v !== "string") return def;
  const s = v.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) || /^rgba?\([\d\s.,%]+\)$/i.test(s) || /^[a-z]{3,20}$/i.test(s)) return s;
  return def;
}

// 채보 gimmicks → 시작 시간순으로 정렬된 연출 목록(잘못된 항목은 버림)
export function prepareFx(gimmicks) {
  if (!Array.isArray(gimmicks)) return [];
  const out = [];
  gimmicks.forEach((g) => {
    if (!g || typeof g !== "object") return;
    const type = String(g.type || "").toLowerCase();
    const def = DEFAULTS[type];
    if (!def) return;
    const start = num(g.time ?? g.startTime ?? g.t, NaN);
    if (!Number.isFinite(start)) return;
    const endRaw = num(g.endTime, NaN);
    const duration = Number.isFinite(endRaw) && endRaw > start ? endRaw - start : Math.max(0.05, num(g.duration ?? g.d ?? g.l, def.duration));
    const bpm = Math.min(400, Math.max(30, num(g.bpm, def.bpm || 120)));
    out.push({
      type,
      back: !!BACK_TYPES[type],
      start,
      end: start + duration,
      duration,
      color: safeColor(g.color, def.color),
      intensity: Math.min(MAX_INTENSITY[type], Math.max(0, num(g.intensity ?? g.value, def.intensity))),
      fade: Math.min(duration / 2, Math.max(0, num(g.fade, def.fade))),
      beatSec: 60 / bpm,
    });
  });
  out.sort((a, b) => a.start - b.start);
  return out;
}

// 페이드 인/아웃을 적용한 0~1 세기
function envelope(fx, t) {
  if (fx.fade <= 0) return 1;
  const fromStart = t - fx.start;
  const toEnd = fx.end - t;
  return Math.min(1, fromStart / fx.fade, toEnd / fx.fade);
}

export class FxPlayer {
  constructor() {
    this.list = [];
    this.active = []; // 지금 재생 중인 연출(재사용 배열)
    this.next = 0; // 아직 시작 안 한 첫 연출 인덱스
    this.lastTime = -Infinity;
  }

  load(gimmicks) {
    this.list = prepareFx(gimmicks);
    this.reset();
  }

  reset() {
    this.active.length = 0;
    this.next = 0;
    this.lastTime = -Infinity;
  }

  get hasFx() {
    return this.list.length > 0;
  }

  // 시간 진행: 새로 시작한 연출 추가, 끝난 연출 제거(배열 재사용, 할당 없음)
  advance(t) {
    if (t < this.lastTime - 0.05) this.reset(); // 시간이 되감기면(재시작 등) 처음부터
    this.lastTime = t;
    const list = this.list;
    while (this.next < list.length && list[this.next].start <= t) {
      const fx = list[this.next];
      if (fx.end > t) this.active.push(fx);
      this.next += 1;
    }
    let w = 0;
    for (let i = 0; i < this.active.length; i += 1) {
      const fx = this.active[i];
      if (fx.end > t) this.active[w++] = fx;
    }
    this.active.length = w;
  }

  // layer: "back"(기어 배경 전) / "gear"(기어 배경 후, 노트 전)
  // geo: { width, height, startX, endX, hitY }
  draw(ctx, t, layer, geo) {
    if (this.active.length === 0) return;
    const wantBack = layer === "back";
    for (let i = 0; i < this.active.length; i += 1) {
      const fx = this.active[i];
      if (fx.back !== wantBack) continue;
      const p = (t - fx.start) / fx.duration; // 0~1 진행도
      if (p < 0 || p >= 1) continue;
      let alpha = 0;
      ctx.fillStyle = fx.color;
      switch (fx.type) {
        case "flash":
          alpha = fx.intensity * (1 - p) * (1 - p);
          ctx.globalAlpha = alpha;
          ctx.fillRect(0, 0, geo.width, geo.height);
          break;
        case "blackout":
          alpha = fx.intensity * envelope(fx, t);
          ctx.globalAlpha = alpha;
          ctx.fillRect(0, 0, geo.width, geo.height);
          break;
        case "tint":
          alpha = fx.intensity * envelope(fx, t);
          ctx.globalAlpha = alpha;
          ctx.fillRect(geo.startX, 0, geo.endX - geo.startX, geo.height);
          break;
        case "pulse": {
          // 기어 양옆에 바깥으로 퍼지는 글로우(사인 맥동)
          const phase = ((t - fx.start) / fx.beatSec) % 1;
          const k = fx.intensity * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2));
          for (let s = 0; s < 4; s += 1) {
            ctx.globalAlpha = k * (0.55 - s * 0.12);
            const w = 4 + s * 6;
            ctx.fillRect(geo.startX - w, 0, 4, geo.height);
            ctx.fillRect(geo.endX + w - 4, 0, 4, geo.height);
          }
          break;
        }
        case "beat": {
          // 박자마다 판정선 주변이 밝아졌다 빠르게 식음(판정선 자체는 DOM이라 그대로)
          const phase = ((t - fx.start) / fx.beatSec) % 1;
          const k = fx.intensity * (1 - phase) * (1 - phase);
          const bw = geo.endX - geo.startX;
          for (let s = 0; s < 5; s += 1) {
            ctx.globalAlpha = k * (0.35 - s * 0.06);
            const h = 10 + s * 14;
            ctx.fillRect(geo.startX, geo.hitY - h, bw, h * 2);
          }
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
