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
          <h1>DJ@ON</h1>
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
  min-height: 100vh;
  overflow: hidden;
  cursor: pointer;
  background: radial-gradient(circle at top left, #0d285f 0%, transparent 30%),
    radial-gradient(circle at bottom right, #240069 0%, transparent 28%),
    #050308;
  color: #fff;
  display: grid;
  place-items: center;
  padding: 60px 40px;
  box-sizing: border-box;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  top: 10%;
  left: 50%;
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(0, 255, 240, 0.18), transparent 45%);
  transform: translateX(-50%);
  filter: blur(50px);
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 160px 160px;
  opacity: 0.5;
}

.scanline {
  position: absolute;
  inset: 0;
  background: linear-gradient(rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.04) 100%);
  pointer-events: none;
  animation: scan 8s linear infinite;
}

.accent-bars {
  position: absolute;
  right: 80px;
  top: 20%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.accent-bars span {
  display: block;
  width: 8px;
  height: 120px;
  background: linear-gradient(180deg, rgba(0,255,255,0.8), transparent);
  border-radius: 999px;
  box-shadow: 0 0 30px rgba(0,255,255,0.3);
}

.hero-panel {
  position: relative;
  z-index: 1;
  max-width: 960px;
  width: 100%;
  padding: 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.hero-copy {
  max-width: 760px;
  text-align: center;
}

.hero-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-transform: uppercase;
}

.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(0, 255, 255, 0.28), rgba(2, 35, 64, 0.75));
  border: 1px solid rgba(0, 255, 255, 0.35);
  box-shadow: 0 0 24px rgba(0, 255, 255, 0.16);
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: #e7fbff;
}

.hero-copy h1 {
  font-size: clamp(4rem, 6vw, 5rem);
  margin: 0;
  letter-spacing: -0.04em;
  text-transform: uppercase;
  text-shadow: 0 0 40px rgba(0, 255, 255, 0.18), 0 12px 30px rgba(0, 0, 0, 0.4);
}

.click-hint {
  margin-top: 14px;
  color: rgba(189, 246, 255, 0.7);
  font-size: 0.96rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-actions {
  display: none;
}

.hero-actions--simple {
  justify-content: flex-start;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #0ff;
  margin-bottom: 14px;
}

.hero-copy h1 {
  font-size: clamp(4rem, 6vw, 5rem);
  margin: 0;
  letter-spacing: -0.04em;
  text-transform: uppercase;
  text-shadow: 0 0 40px rgba(0, 255, 255, 0.18), 0 12px 30px rgba(0, 0, 0, 0.4);
}

.click-hint {
  margin-top: 14px;
  color: rgba(189, 246, 255, 0.7);
  font-size: 0.96rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-actions {
  display: none;
}

.hero-actions--simple {
  justify-content: flex-start;
}

.hero-copy h1 {
  font-size: clamp(4rem, 6vw, 5rem);
  margin: 0;
  letter-spacing: -0.04em;
}

@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

@media only screen and (max-width: 980px) {
  .home-page { padding: 30px 20px; }
  .accent-bars { display: none; }
  .hero-panel { padding: 26px; }
  .hero-copy h1 { font-size: 3.6rem; }
}

@media only screen and (max-width: 640px) {
  .hero-copy h1 { font-size: 2.8rem; }
  .hero-actions { flex-direction: column; align-items: stretch; }
}
</style>
