<template>
  <div class="home-page" @click="goToGame">
    <div class="hero-bg">
      <div class="hero-glow"></div>
      <div class="grid-lines"></div>
      <div class="scanline"></div>
      <div class="accent-bars">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>

    <div class="hero-panel">
      <div class="hero-copy">
        <div class="hero-logo">
          <span class="logo-mark">D</span>
          <h1>DJ<span class="at">@</span>ON</h1>
        </div>
        <div class="click-hint">Click anywhere to begin</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Home",
  methods: {
    goToGame() {
      this.$router.push("/menu");
    },
  },
};
</script>

<style scoped>
.home-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  cursor: pointer;
  color: var(--dm-text);
  background: var(--dm-bg);
  font-family: var(--dm-font-body);
}

.hero-bg {
  position: absolute;
  inset: 0;
}

/* diagonal light beam + fine diagonal lines */
.hero-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(
      115deg,
      transparent 0%,
      transparent 38%,
      rgba(25, 211, 255, 0.1) 38%,
      rgba(25, 211, 255, 0.03) 62%,
      transparent 62%
    ),
    radial-gradient(ellipse at 50% 50%, rgba(25, 211, 255, 0.1) 0%, transparent 55%);
}

.grid-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    115deg,
    rgba(25, 211, 255, 0.06) 0,
    rgba(25, 211, 255, 0.06) 1px,
    transparent 1px,
    transparent 18px
  );
}

.scanline {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--dm-cyan-dim) 20%, var(--dm-cyan-dim) 80%, transparent);
  transform: translateY(96px);
}

/* slanted bars on the right edge */
.accent-bars {
  position: absolute;
  top: 0;
  right: 6%;
  bottom: 0;
  display: flex;
  gap: 14px;
  align-items: flex-end;
}

.accent-bars span {
  display: block;
  width: 26px;
  transform: skewX(-18deg);
  background: linear-gradient(180deg, transparent, var(--dm-cyan));
  opacity: 0.55;
}

.accent-bars span:nth-child(1) {
  height: 46%;
}

.accent-bars span:nth-child(2) {
  height: 66%;
  opacity: 0.35;
}

.accent-bars span:nth-child(3) {
  height: 30%;
  opacity: 0.75;
}

.hero-panel {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.hero-logo {
  display: flex;
  align-items: center;
  gap: 26px;
}

.logo-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 92px;
  line-height: 1;
  color: #04121c;
  background: var(--dm-cyan);
  clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 26px 100%, 0 calc(100% - 26px));
}

.hero-logo h1 {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 148px;
  line-height: 0.9;
  letter-spacing: 0.02em;
  color: #ffffff;
  text-shadow: 0 0 34px rgba(25, 211, 255, 0.35);
}

.hero-logo h1 .at {
  color: var(--dm-cyan);
}

.click-hint {
  display: flex;
  align-items: center;
  gap: 22px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 24px;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: var(--dm-muted);
  animation: blink 1.6s ease-in-out infinite;
}

.click-hint::before,
.click-hint::after {
  content: "";
  width: 90px;
  height: 1px;
  background: var(--dm-cyan-dim);
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
