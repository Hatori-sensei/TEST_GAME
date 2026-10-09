<template>
  <div>
    <div class="health_bar_wrapper" v-if="!vm.noFail">
      <div class="health_bar" :style="barStyle"></div>
    </div>
    <transition name="modal-fade">
      <div
        class="low_health"
        v-if="vm.instance && !vm.instance.paused && vm.health < 20"
      ></div>
    </transition>
    <div class="score" v-if="vm.instance">
      <div
        class="performanceWarning"
        v-if="
          vm.fps && vm.started && vm.instance && !vm.instance.paused && vm.instance.fps < 35
        "
      >
        Game Performance Degraded
      </div>
      <div style="font-size: 0.5em;" v-if="vm.fps && vm.instance.fps">
        {{ vm.instance.fps }} FPS
      </div>
      <div class="score-acc">
        <ICountUp
          :endVal="vm.percentage"
          :options="{ decimalPlaces: 2, duration: 1 }"
        />%
      </div>
      <div class="score-label">SCORE</div>
      <ICountUp
        class="score-num"
        :endVal="vm.result.score"
        :options="{ decimalPlaces: 0, duration: 1 }"
      />
    </div>
  </div>
</template>

<script>
import ICountUp from "vue-countup-v2";

export default {
  name: "ScorePanel",
  data() {
    return {};
  },
  props: {},
  mounted() {},
  components: {
    ICountUp,
  },
  computed: {
    vm() {
      return this.$parent;
    },
    barStyle() {
      const health = this.vm.health;
      let colour = "rgb(53, 211, 53)";
      if (health < 30) colour = "red";
      else if (health < 40) colour = "orange";
      else if (health < 70) colour = "yellow";
      else if (health < 100) colour = "#cceb34";
      return {
        width: health + "%",
        backgroundColor: colour,
        boxShadow: `0 0 10px ${colour}, 0 0 30px ${colour}, 0 0 5px ${colour}`,
      };
    },
  },
};
</script>

<style scoped>
.score {
  position: fixed;
  bottom: 24px;
  left: 28px;
  padding: 6px 26px 8px 16px;
  border-left: 4px solid var(--dm-cyan);
  background: linear-gradient(90deg, rgba(4, 8, 16, 0.85), rgba(4, 8, 16, 0));
  font-family: var(--dm-font-display);
  font-style: italic;
  display: flex;
  flex-direction: column;
}

.score-acc {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--dm-cyan);
  letter-spacing: 0.04em;
}

.score-label {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.32em;
  color: var(--dm-muted);
  margin-top: 4px;
}

.score-num {
  font-size: 3.2rem;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
}

.performanceWarning {
  font-size: 0.5em;
  background: orange;
  color: white;
  padding: 5px;
}

.health_bar_wrapper {
  position: fixed;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 200px;
  background-color: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: flex-end;
}

.health_bar {
  height: 3px;
  transition: background-color 1s;
}

.low_health {
  position: fixed;
  top: 0;
  right: 0;
  width: 100vw;
  height: 100vh;
  animation: health_low 5s ease infinite;
  box-shadow: inset 0 0 180px 50px red;
  pointer-events: none;
}

@keyframes health_low {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 0.8;
  }
}
</style>
