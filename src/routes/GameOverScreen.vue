<template>
  <div class="gameover-container">
    <div class="crt-turn-off-overlay"></div>

    <div class="go-lines"></div>
    <div class="go-beam"></div>
    <div class="go-shade"></div>

    <div class="go-content">
      <div class="go-label"><span class="slashes">///</span> STAGE FAILED</div>
      <div class="gameover">GAME <span class="over">OVER</span></div>

      <div class="go-buttons">
        <div
          class="btn-action btn-dark go-btn go-btn-main"
          @click="replay"
          v-if="$route.params.sheetId"
        >
          <v-icon name="redo" />
          <span>Replay</span>
        </div>
        <div class="btn-action btn-dark go-btn" @click="toMenu">
          <v-icon name="arrow-right" />
          <span>Continue</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "GameOverScreen",
  mounted() {
    this.$store.state.audio.playEffect("whoosh");
  },
  methods: {
    replay() {
      this.$router.push("/game/" + this.$route.params.sheetId);
    },
    toMenu() {
      this.$router.push("/menu/");
    },
  },
};
</script>

<style scoped>
.gameover-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);

  /* TV-on: expands from a horizontal line */
  transform-origin: center center;
  animation: crt_on_expand 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

@keyframes crt_on_expand {
  0% {
    transform: scale(1, 0.002);
    filter: brightness(10);
  }
  40% {
    transform: scale(1, 0.01);
    filter: brightness(8);
  }
  100% {
    transform: scale(1, 1);
    filter: brightness(1);
  }
}

.go-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    115deg,
    rgba(255, 59, 92, 0.06) 0,
    rgba(255, 59, 92, 0.06) 1px,
    transparent 1px,
    transparent 16px
  );
}

/* red diagonal beam: a failed stage is red, not cyan */
.go-beam {
  position: absolute;
  inset: 0;
  background: linear-gradient(
      115deg,
      transparent 0%,
      transparent 34%,
      rgba(255, 59, 92, 0.14) 34%,
      rgba(255, 59, 92, 0.03) 66%,
      transparent 66%
    ),
    radial-gradient(ellipse at 50% 50%, rgba(255, 59, 92, 0.1) 0%, transparent 60%);
}

.go-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(4, 6, 12, 0.5), transparent 30%, transparent 70%, rgba(4, 6, 12, 0.7));
}

.go-content {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
  animation: ui_fade_in 0.6s 0.4s forwards;
}

@keyframes ui_fade_in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 20px));
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.go-label {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.4em;
  color: var(--dm-muted);
}

.go-label .slashes {
  color: var(--dm-red);
  letter-spacing: -0.05em;
}

.gameover {
  margin: 6px 0 64px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(110px, 24vh, 260px);
  line-height: 0.95;
  letter-spacing: 0.02em;
  color: #ffffff;
  text-shadow: 0 0 40px rgba(255, 59, 92, 0.35);
}

.gameover .over {
  color: var(--dm-red);
}

.go-buttons {
  display: flex;
  gap: 18px;
}

.go-btn {
  min-width: 220px;
  margin: 0;
  font-size: 1.5em;
}

.go-btn-main {
  color: #04121c;
  background: var(--dm-cyan);
}

.go-btn-main .fa-icon {
  color: #04121c;
}

@media screen and (max-width: 600px) {
  .gameover {
    font-size: 5.5em;
  }
}
</style>
