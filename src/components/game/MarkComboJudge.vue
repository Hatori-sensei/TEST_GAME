<template>
  <transition name="fade">
    <div class="judge" v-if="showAll">
      <transition name="modal-fade">
        <div class="combo" v-if="combo >= 5" :class="comboEvolutionClass">
          <div>Combo</div>
          <div class="comboNum comboAnimation" v-if="display">
            {{ combo }}
          </div>
          <!-- [피버] 피버 배율(콤보 증가량 x1~x5)과 다음 단계까지의 게이지. 미스하면 콤보와 같이 초기화 -->
          <div class="fever" :class="{ on: feverLevel > 1 }">
            <span class="fever-label">FEVER</span>
            <span class="fever-mult">x{{ feverLevel }}</span>
            <span class="fever-bar"><span class="fever-fill" :style="{ width: feverPercent + '%' }"></span></span>
          </div>
        </div>
      </transition>
      <div class="center_judge judgeAnimation" v-if="display">
        <!-- [UI] FAST/SLOW: beatmania IIDX/EZ2ON 방식. 판정 글자 위에 작게(노트 진행 방향을 덜 가리게) -->
        <div v-if="timing" class="fast-slow" :class="'fs-' + timing">{{ timing }}</div>
        <div class="judgeTypeAnimation" :class="judgeType">{{ markJudge }}</div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: "MarkComboJudge",
  data: () => {
    return {
      showAll: false,
      display: true,
      markJudge: "",
      combo: 0,
      comboAni: {},
      judgeType: {},
      timeout: null,
      comboEvolutionClass: "",
      timing: null, // "fast" | "slow" | null
      feverLevel: 1, // [피버] result.feverMultiplier(반응형이 아니라서 judge 때 복사)
      feverPercent: 0, // [피버] result.feverGauge(0~100)
    };
  },
  methods: {
    // [피버] 게임 화면의 result에서 피버 배율/게이지를 읽어 옴(채보 에디터 등엔 없을 수 있음)
    syncFever() {
      const r = this.$parent && this.$parent.result;
      const level = r && r.feverMultiplier ? Number(r.feverMultiplier) : 1;
      const gauge = r && r.feverGauge ? Number(r.feverGauge) : 0;
      this.feverLevel = level;
      this.feverPercent = level >= 5 ? 100 : Math.max(0, Math.min(100, gauge));
    },
    judgeClassFor(mark) {
      if (mark === "BREAK") return "judge-break";
      const pct = parseInt(String(mark).replace(/[^0-9]/g, ""), 10);
      if (!Number.isFinite(pct)) return "judge-break";
      if (pct >= 100) return "judge-max";
      if (pct >= 70) return "judge-high";
      if (pct >= 40) return "judge-mid";
      return "judge-low";
    },
    judge(mark, combo, timing = null) {
      this.timing = timing;
      this.markJudge = mark;
      this.combo = combo;
      this.display = false;
      this.judgeType = { [this.judgeClassFor(mark)]: true };
      this.syncFever();
      
      // 콤보에 따른 진화 클래스 설정
      if (combo >= 100) {
        this.comboEvolutionClass = "combo-evolution-mega";
      } else if (combo >= 50) {
        this.comboEvolutionClass = "combo-evolution-large";
      } else if (combo >= 10) {
        this.comboEvolutionClass = "combo-evolution-medium";
      } else {
        this.comboEvolutionClass = "combo-evolution-small";
      }
      
      this.showAll = true;
      this.$nextTick(() => {
        this.display = true;
      });
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        this.showAll = false;
      }, 3000);
    },
  },
};
</script>

<style scoped>
/* [테마] 판정/콤보/피버 색은 변수로. 아래 기본값 = 테마 1(변경 전과 같은 값).
   테마 2/3은 public/theme-afterglow.css, theme-monochrome.css에서 html[data-theme] .judge로 덮어씀 */
.judge {
  user-select: none;
  pointer-events: none;
  text-align: center;
  text-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
  --combo-label-color: var(--dm-cyan);
  --combo-num-color: #ffffff;
  --combo-num-shadow: 0 0 14px rgba(25, 211, 255, 0.85), 0 0 34px rgba(25, 211, 255, 0.4);
  --combo-glow-rgb: 0, 255, 255;
  --combo-mega-rgb: 0, 255, 0;
  --judge-font-style: italic;
  --fs-fast-color: #19d3ff;
  --fs-fast-shadow: 0 0 8px rgba(25, 211, 255, 0.8);
  --fs-slow-color: #ff5a7a;
  --fs-slow-shadow: 0 0 8px rgba(255, 90, 122, 0.8);
  --j-max-text: #ffffff;
  --j-max-shadow: #19d3ff;
  --j-high-text: #19d3ff;
  --j-high-shadow: #19d3ff;
  --j-mid-text: #ffb400;
  --j-mid-shadow: #ffb400;
  --j-low-text: #ff7a2f;
  --j-low-shadow: #ff7a2f;
  --j-break-text: #ff3b5c;
  --j-break-shadow: #b3001f;
  --fever-label-color: var(--dm-cyan);
  --fever-mult-color: #ffb400;
  --fever-bar-bg: rgba(25, 211, 255, 0.18);
  --fever-bar-border: rgba(25, 211, 255, 0.5);
  --fever-fill: #19d3ff;
  --fever-fill-on: linear-gradient(90deg, #19d3ff, #ffb400);
}

.combo {
  position: absolute;
  width: 400px;
  height: 80px;
  top: 15%;
  left: 50%;
  margin-left: -200px;
  z-index: 100;
  font-size: 1.5em;
  color: var(--combo-label-color);
  font-family: var(--dm-font-display);
  font-style: var(--judge-font-style);
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.comboNum {
  font-family: var(--dm-font-display);
  font-style: var(--judge-font-style);
  margin-top: -14px;
  font-size: 5em;
  font-weight: 800;
  line-height: 1;
  color: var(--combo-num-color);
  text-shadow: var(--combo-num-shadow);
  transition: all 0.3s ease;
}

.center_judge {
  font-family: var(--dm-font-display);
  font-style: var(--judge-font-style);
  position: absolute;
  font-size: 4.2em;
  line-height: 80px;
  width: 400px;
  height: 80px;
  top: 59%;
  left: 50%;
  margin-left: -200px;
  z-index: 100;
  --judge-text-color: #ffffff;
  --judge-shadow-color: #000000;
  /* transition: opacity 2s ease-in-out; */
}

@media only screen and (max-width: 1000px) {
  /* mobile */
  .center_judge {
    margin-top: -45px;
  }

  .combo {
    margin-top: -35px;
  }
}

.animationNone {
  animation: none;
  animation-name: none;
}

.comboAnimation {
  animation-name: comboAni;
  animation-duration: 0.1s;
}

.judgeAnimation {
  animation-name: judgeAni;
  animation-duration: 0.1s;
}

.judgeTypeAnimation {
  animation-name: perfectAni;
  animation-duration: 0.5s;
  letter-spacing: 0.06em;
  font-weight: 800;
  text-transform: uppercase;
}
.fast-slow {
  position: absolute;
  left: 0;
  right: 0;
  top: -26px;
  font-size: 22px;
  line-height: 22px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.fs-fast {
  color: var(--fs-fast-color);
  text-shadow: var(--fs-fast-shadow);
}
.fs-slow {
  color: var(--fs-slow-color);
  text-shadow: var(--fs-slow-shadow);
}
.judge-max {
  --judge-text-color: var(--j-max-text);
  --judge-shadow-color: var(--j-max-shadow);
}
.judge-high {
  --judge-text-color: var(--j-high-text);
  --judge-shadow-color: var(--j-high-shadow);
}
.judge-mid {
  --judge-text-color: var(--j-mid-text);
  --judge-shadow-color: var(--j-mid-shadow);
}
.judge-low {
  --judge-text-color: var(--j-low-text);
  --judge-shadow-color: var(--j-low-shadow);
}
.judge-break {
  --judge-text-color: var(--j-break-text);
  --judge-shadow-color: var(--j-break-shadow);
}

/* [피버] 콤보 숫자 아래 작은 줄: FEVER x2 + 게이지 */
.fever {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 0.62em;
  letter-spacing: 0.24em;
  text-shadow: none;
}
.fever-label {
  color: var(--fever-label-color);
  opacity: 0.75;
}
.fever-mult {
  min-width: 2.2em;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--fever-mult-color);
  opacity: 0.6;
}
.fever.on .fever-label,
.fever.on .fever-mult {
  opacity: 1;
}
.fever-bar {
  position: relative;
  width: 120px;
  height: 8px;
  background: var(--fever-bar-bg);
  border: 1px solid var(--fever-bar-border);
  overflow: hidden;
}
.fever-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--fever-fill);
  transition: width 0.15s linear;
}
.fever.on .fever-fill {
  background: var(--fever-fill-on);
}

@keyframes comboAni {
  from {
    padding-top: 0;
    opacity: 0.5;
  }

  30% {
    padding-top: 20px;
    opacity: 1;
  }

  100% {
    padding-top: 0px;
    opacity: 1;
  }
}

@keyframes judgeAni {
  from {
    transform: scale(1);
  }

  30% {
    transform: scale(1.25);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes perfectAni {
  from {
    text-shadow: none;
    opacity: 0.8;
    filter: brightness(0.8);
  }

  30% {
    color: var(--judge-text-color);
    text-shadow: 0 0 20px var(--judge-shadow-color), 0 0 40px var(--judge-shadow-color);
    opacity: 1;
    filter: brightness(1.3);
  }

  100% {
    color: var(--judge-text-color);
    text-shadow: 0 0 10px var(--judge-shadow-color);
    filter: brightness(1);
  }
}

/* 콤보 진화: 콤보 수에 따른 크기 증가 및 글로우 강화 */
.combo-evolution-small {
  animation: comboEvolveSmall 0.3s ease;
}

.combo-evolution-medium {
  animation: comboEvolveMedium 0.3s ease;
}

.combo-evolution-large {
  animation: comboEvolveLarge 0.3s ease;
}

.combo-evolution-mega {
  animation: comboEvolveMega 0.3s ease;
}

@keyframes comboEvolveSmall {
  0% { transform: scale(1); }
  100% { transform: scale(1); }
}

@keyframes comboEvolveMedium {
  0% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(var(--combo-glow-rgb), 0.5)); }
  100% { transform: scale(1.15); filter: drop-shadow(0 0 25px rgba(var(--combo-glow-rgb), 0.8)); }
}

@keyframes comboEvolveLarge {
  0% { transform: scale(1.15); filter: drop-shadow(0 0 25px rgba(var(--combo-glow-rgb), 0.8)); }
  100% { transform: scale(1.3); filter: drop-shadow(0 0 40px rgba(var(--combo-glow-rgb), 1)); }
}

@keyframes comboEvolveMega {
  0% { transform: scale(1.3); filter: drop-shadow(0 0 40px rgba(var(--combo-glow-rgb), 1)); }
  50% { transform: scale(1.4); filter: drop-shadow(0 0 60px rgba(var(--combo-mega-rgb), 1)); }
  100% { transform: scale(1.35); filter: drop-shadow(0 0 50px rgba(var(--combo-glow-rgb), 0.9)); }
}
</style>
