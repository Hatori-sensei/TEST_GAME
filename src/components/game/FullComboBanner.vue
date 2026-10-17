<template>
  <!-- [풀콤보] 곡 끝 풀콤보 연출: 섬광 → 화면을 가로지르는 띠가 열리고 글자가 미끄러져 들어옴 → 닫힘(약 2초).
       효과음 없음. 색/모양은 테마 변수(--fc-*)로, 기본값 = 테마 1. 판정/점수와 무관한 그림 전용. -->
  <div class="fc" v-if="active" :key="runId">
    <div class="fc-flash"></div>
    <div class="fc-band">
      <div class="fc-edge top"></div>
      <div class="fc-sweep"></div>
      <div class="fc-text">
        <span class="fc-main">FULL COMBO</span>
        <span class="fc-sub">ALL NOTES CONNECTED</span>
      </div>
      <div class="fc-edge bottom"></div>
    </div>
  </div>
</template>

<script>
const DURATION_MS = 2000;

export default {
  name: "FullComboBanner",
  data: () => ({ active: false, runId: 0, timer: null }),
  methods: {
    play() {
      clearTimeout(this.timer);
      this.runId += 1;
      this.active = true;
      this.timer = setTimeout(() => {
        this.active = false;
      }, DURATION_MS + 100);
    },
  },
  beforeDestroy() {
    clearTimeout(this.timer);
  },
};
</script>

<style scoped>
.fc {
  /* 테마 1(DJMAX) 기본값. 테마 2/3은 public/theme-*.css의 html[data-theme] .fc에서 덮어씀 */
  --fc-flash: rgba(25, 211, 255, 0.35);
  --fc-band-bg: linear-gradient(90deg, transparent 0%, rgba(4, 10, 20, 0.94) 14%, rgba(4, 10, 20, 0.94) 86%, transparent 100%);
  --fc-edge: linear-gradient(90deg, transparent 0%, #19d3ff 14%, #19d3ff 86%, transparent 100%);
  --fc-edge-height: 3px;
  --fc-text: #ffffff;
  --fc-text-shadow: 0 0 18px rgba(25, 211, 255, 0.9), 0 0 42px rgba(25, 211, 255, 0.5);
  --fc-sub: #19d3ff;
  --fc-sweep: linear-gradient(90deg, transparent, rgba(160, 240, 255, 0.55), transparent);
  --fc-font-style: italic;
  --fc-skew: -10deg;
  position: fixed;
  inset: 0;
  z-index: 1100;
  pointer-events: none;
  overflow: hidden;
}

.fc-flash {
  position: absolute;
  inset: 0;
  background: var(--fc-flash);
  animation: fc-flash 0.45s ease-out both;
}

.fc-band {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 190px;
  margin-top: -95px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--fc-band-bg);
  transform-origin: center;
  animation: fc-band 2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.fc-edge {
  height: var(--fc-edge-height);
  background: var(--fc-edge);
}

.fc-sweep {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 28%;
  left: -30%;
  background: var(--fc-sweep);
  transform: skewX(-20deg);
  animation: fc-sweep 0.7s 0.35s ease-in-out both;
}

.fc-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--dm-font-display);
  font-style: var(--fc-font-style);
  transform: skewX(var(--fc-skew));
}

.fc-main {
  white-space: nowrap;
  font-weight: 800;
  font-size: clamp(56px, 7vw, 112px);
  line-height: 1;
  color: var(--fc-text);
  text-shadow: var(--fc-text-shadow);
  animation: fc-main 2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.fc-sub {
  white-space: nowrap;
  margin-top: 8px;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.6em;
  color: var(--fc-sub);
  animation: fc-sub 2s ease-out both;
}

@keyframes fc-flash {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fc-band {
  0% {
    transform: scaleY(0);
    opacity: 1;
  }
  14% {
    transform: scaleY(1);
  }
  82% {
    transform: scaleY(1);
    opacity: 1;
  }
  100% {
    transform: scaleY(0);
    opacity: 0;
  }
}

@keyframes fc-main {
  0%,
  8% {
    opacity: 0;
    transform: translateX(-80px);
    letter-spacing: 0.5em;
  }
  26% {
    opacity: 1;
    transform: translateX(0);
    letter-spacing: 0.08em;
  }
  80% {
    opacity: 1;
    transform: translateX(14px);
    letter-spacing: 0.1em;
  }
  100% {
    opacity: 0;
    transform: translateX(90px);
    letter-spacing: 0.1em;
  }
}

@keyframes fc-sub {
  0%,
  22% {
    opacity: 0;
  }
  34%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes fc-sweep {
  from {
    left: -30%;
  }
  to {
    left: 110%;
  }
}
</style>
