<template>
  <div class="health-bar">
    <div class="health-bar-fill" :style="healthStyle"></div>
    <div class="health-bar-segments"></div>
  </div>
</template>

<script>
export default {
  name: "HealthBar",
  props: {
    health: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  computed: {
    healthStyle() {
      const percentage = Math.max(0, Math.min(100, this.health));
      let color = "#19d3ff";
      if (percentage <= 50) {
        color = "#ffb400";
      }
      if (percentage <= 25) {
        color = "#ff3b5c";
      }
      return {
        height: `${percentage}%`,
        backgroundColor: color,
        boxShadow: `0 0 12px ${color}`,
        transition: "height 0.3s ease-out, background-color 0.3s ease-out"
      };
    }
  }
};
</script>

<style scoped>
/* Vertical bar glued to the right side of the gear (gear = 500px + 2px rails, centered). */
.health-bar {
  position: fixed;
  left: calc(50% + 252px + 6px);
  top: 140px;
  bottom: 320px;
  width: 16px;
  z-index: 999;
  display: flex;
  align-items: flex-end;
  background-color: rgba(3, 7, 14, 0.85);
  border: 1px solid var(--dm-cyan-dim);
  border-left: 3px solid var(--dm-cyan);
  box-sizing: border-box;
  overflow: hidden;
}

.health-bar-fill {
  width: 100%;
  height: 100%;
}

/* cuts the bar into horizontal segments */
.health-bar-segments {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 14px,
    rgba(3, 7, 14, 0.9) 14px,
    rgba(3, 7, 14, 0.9) 16px
  );
  pointer-events: none;
}
</style>
