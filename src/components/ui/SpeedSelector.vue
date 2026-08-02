<template>
  <div class="speed-selector">
    <label>Speed: <strong>{{ speed.toFixed(1) }}x</strong></label>
    <input type="range" min="0.5" max="5.0" step="0.1" v-model.number="speed" @input="apply" />
  </div>
</template>

<script>
export default {
  name: "SpeedSelector",
  props: {
    value: { type: Number, default: 1.0 },
  },
  data() {
    return { speed: this.value };
  },
  methods: {
    apply() {
      this.$emit("input", this.speed);
      // also commit to store for global visibility
      if (this.$store && typeof this.$store.commit === "function") {
        this.$store.commit("setSpeedMultiplier", this.speed);
      }
    },
  },
  mounted() {
    // ensure initial commit
    this.apply();
  },
};
</script>

<style scoped>
.speed-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e8f8ff;
}
input[type="range"] {
  width: 160px;
}
</style>