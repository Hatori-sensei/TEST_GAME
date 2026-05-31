<template>
  <div class="health-bar-container">
    <div class="health-bar-background">
      <div class="health-bar-fill" :style="healthStyle"></div>
    </div>
    <div class="health-text">{{ Math.ceil(health) }}%</div>
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
      let color = "#00ff00"; // 초록색 (좋음)
      if (percentage <= 50) {
        color = "#ffff00"; // 노랑색 (위험)
      }
      if (percentage <= 25) {
        color = "#ff0000"; // 빨강색 (매우 위험)
      }
      return {
        width: `${percentage}%`,
        backgroundColor: color,
        transition: "width 0.3s ease-out, background-color 0.3s ease-out"
      };
    }
  }
};
</script>

<style scoped>
.health-bar-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 10px;
}

.health-bar-background {
  width: 200px;
  height: 30px;
  background-color: #333;
  border: 2px solid #666;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.health-bar-fill {
  height: 100%;
  width: 100%;
  background-color: #00ff00;
  transition: width 0.3s ease-out, background-color 0.3s ease-out;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.3);
}

.health-text {
  color: white;
  font-weight: bold;
  font-size: 18px;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.8);
  min-width: 50px;
}

@media only screen and (max-width: 1000px) {
  .health-bar-container {
    top: 10px;
    right: 10px;
  }

  .health-bar-background {
    width: 150px;
    height: 25px;
  }

  .health-text {
    font-size: 14px;
  }
}
</style>
