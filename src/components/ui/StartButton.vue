<template>
  <div
    class="wrap"
    v-if="$store.state.theme"
    :class="{ [$store.state.theme.buttonStyle]: true }"
  >
    <button class="main_button" @click="hanldeClick" @mouseenter="hanldeHover">
      {{ text }}
    </button>
  </div>
</template>

<script>
export default {
  name: "StartButton",
  props: ["text"],
  data: function () {
    return {};
  },
  mounted() {},
  methods: {
    hanldeHover() {
      this.$store.state.audio.playHoverEffect("ui/click2");
    },
    hanldeClick() {
      this.$store.state.audio.playEffect("ui/power");
      this.$emit("click");
    },
  },
};
</script>

<style scoped>
.wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main_button {
  min-width: 260px;
  min-height: 56px;
  font-size: 18px;
  letter-spacing: 1.6px;
  font-weight: 700;
  color: #ffffff;
  background: rgba(0, 255, 255, 0.18);
  border: 1px solid rgba(0, 255, 255, 0.32);
  backdrop-filter: blur(14px);
  border-radius: 999px;
  box-shadow: 0 12px 32px rgba(0, 220, 255, 0.16);
  transition: transform 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
  cursor: pointer;
  outline: none;
  position: relative;
  padding: 14px 28px;
}

.main_button:hover,
.main_button:focus {
  transform: translateY(-3px);
  background: rgba(0, 255, 255, 0.24);
  box-shadow: 0 18px 42px rgba(0, 220, 255, 0.22);
}

.main_button::before,
.main_button::after {
  display: none;
}
</style>
