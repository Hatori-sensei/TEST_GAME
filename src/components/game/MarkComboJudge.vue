<template>
  <transition name="fade">
    <div class="judge" v-if="showAll">
      <transition name="modal-fade">
        <div class="combo" v-if="combo >= 5" :class="comboEvolutionClass">
          <div>Combo</div>
          <div class="comboNum comboAnimation" v-if="display">
            {{ combo }}
          </div>
        </div>
      </transition>
      <div class="center_judge judgeAnimation" v-if="display">
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
    };
  },
  methods: {
    judge(mark, combo) {
      this.markJudge = mark;
      this.combo = combo;
      this.display = false;
      this.judgeType = { ["judge" + this.markJudge]: true };
      
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
.judge {
  user-select: none;
  pointer-events: none;
  text-align: center;
  text-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
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
  color: #00ffff;
}

.comboNum {
  font-family: "Anton", Impact, "Raleway", "Arial Narrow Bold", sans-serif;
  margin-top: -10px;
  font-size: 4em;
  font-weight: bold;
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  transition: all 0.3s ease;
}

.center_judge {
  font-family: "Raleway";
  position: absolute;
  font-size: 5em;
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
  letter-spacing: 2px;
  font-weight: 900;
}

.judgePerfect {
  --judge-text-color: #15ff00;
  --judge-shadow-color: #15ff00;
}

.judgeGood {
  --judge-text-color: #00ffea;
  --judge-shadow-color: #00ffea;
}

.judgeOffbeat {
  --judge-text-color: rgb(255, 115, 0);
  --judge-shadow-color: rgb(255, 115, 0);
}

.judgeMiss {
  --judge-text-color: rgb(255, 50, 50);
  --judge-shadow-color: rgb(139, 0, 0);
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
  0% { transform: scale(1); filter: drop-shadow(0 0 15px rgba(0, 255, 255, 0.5)); }
  100% { transform: scale(1.15); filter: drop-shadow(0 0 25px rgba(0, 255, 255, 0.8)); }
}

@keyframes comboEvolveLarge {
  0% { transform: scale(1.15); filter: drop-shadow(0 0 25px rgba(0, 255, 255, 0.8)); }
  100% { transform: scale(1.3); filter: drop-shadow(0 0 40px rgba(0, 255, 255, 1)); }
}

@keyframes comboEvolveMega {
  0% { transform: scale(1.3); filter: drop-shadow(0 0 40px rgba(0, 255, 255, 1)); }
  50% { transform: scale(1.4); filter: drop-shadow(0 0 60px rgba(0, 255, 0, 1)); }
  100% { transform: scale(1.35); filter: drop-shadow(0 0 50px rgba(0, 255, 255, 0.9)); }
}
</style>
