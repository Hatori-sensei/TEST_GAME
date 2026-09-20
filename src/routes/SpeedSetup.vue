<template>
  <div class="speed-setup">
    <div class="container" :style="{'--speed': speed}">
      <div class="panel">
        <h2>배속 설정</h2>
        <p class="subtitle">게임 시작 전 배속 설정(1:배속 감소, 2:배속 증가) <br>
          오른쪽에서 미리보기를 참고해주세요..</p>

        <div class="center" role="region" aria-label="speed-controls">
          <!-- Slider removed per requirements; keyboard controls used instead -->
          <div class="speed-value">{{ formattedSpeed }}x</div>

          <div class="actions">
            <button @click="startGame">Start Game</button>
            <button @click="cancel">Cancel</button>
          </div>

          <div class="hint">1 / 2 키로 배속 조절 (최소 1.0, 최대 9.9)</div>
        </div>
      </div>

      <!-- Right-side realtime preview (vertical lane) -->
      <div class="preview">
        <div class="lane">
          <!-- multiple notes staggered for continuous preview -->
          <div class="note" style="left:50%; animation-delay: 0s"></div>
          <div class="note" style="left:50%; animation-delay: 0.9s"></div>
          <div class="note" style="left:50%; animation-delay: 1.8s"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "SpeedSetup",
  data() {
    const storeSpeed = Number(this.$store.state.speedMultiplier);
    const profileSpeed = Number(this.$store.state.userProfile?.gameSt?.noteSpeed);
    const initialSpeed = Number.isFinite(profileSpeed) && profileSpeed > 0
      ? profileSpeed
      : Number.isFinite(storeSpeed) && storeSpeed > 0
      ? storeSpeed
      : 1.0;

    return { speed: Math.min(9.9, Math.max(1.0, initialSpeed)) };
  },
  computed: {
    formattedSpeed() {
      // Ensure one decimal string but keep numeric value in data
      return parseFloat(this.speed).toFixed(1);
    }
  },
  mounted() {
    // If arrived without a pending sheet, redirect to menu
    const sheetId = this.$route.params.sheet;
    if (!sheetId && !this.$store.state.pendingSheetId) {
      this.$router.push('/menu');
      return;
    }

    // Keep store speed synchronized with the initial value shown in this setup screen.
    this.$store.commit('setSpeedMultiplier', parseFloat(parseFloat(this.speed).toFixed(1)));

    // Register global key listener for 1 and 2 keys
    window.addEventListener('keydown', this.onKeyDown);
  },
  beforeDestroy() {
    // Remove listener when component destroyed
    window.removeEventListener('keydown', this.onKeyDown);
  },
  methods: {
    startGame() {
      const sheetId = this.$route.params.sheet || this.$store.state.pendingSheetId;
      // commit numeric value
      const numeric = parseFloat(parseFloat(this.speed).toFixed(1));
      this.$store.commit('setSpeedMultiplier', numeric);
      const existingOptions = this.$store.state.pendingGameOptions || {};
      const modeRaw =
        existingOptions.randomGimmickMode !== undefined
          ? existingOptions.randomGimmickMode
          : this.$store.state.randomGimmickMode;
      const mode = String(modeRaw || 'off').toLowerCase();
      const randomGimmickMode = ['off', 'speed', 'lane', 'both'].includes(mode)
        ? mode
        : 'off';
      this.$store.commit('setPendingGameOptions', {
        ...existingOptions,
        randomGimmickMode,
      });
      // clear pending
      this.$store.commit('setPendingSheetId', null);
      this.$router.push(`/game/${sheetId}`);
    },
    cancel() {
      this.$store.commit('setPendingSheetId', null);
      this.$store.commit('setPendingGameOptions', null);
      this.$router.push('/menu');
    },
    onKeyDown(e) {
      // Ignore when focus is in an input or textarea
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === '1') {
        // decrease by 0.1
        let next = parseFloat((parseFloat(this.speed) - 0.1).toFixed(1));
        if (next < 1.0) next = 1.0;
        this.speed = next;
      } else if (e.key === '2') {
        // increase by 0.1
        let next = parseFloat((parseFloat(this.speed) + 0.1).toFixed(1));
        if (next > 9.9) next = 9.9;
        this.speed = next;
      }
      // Vue reactivity updates formattedSpeed and the CSS var used for animation
    }
  }
};
</script>

<style scoped>
.speed-setup {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: repeating-linear-gradient(
      115deg,
      rgba(25, 211, 255, 0.05) 0,
      rgba(25, 211, 255, 0.05) 1px,
      transparent 1px,
      transparent 16px
    ),
    radial-gradient(ellipse at 50% 40%, #0b1a2c 0%, var(--dm-bg) 70%);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
}

.container {
  display: flex;
  gap: 36px;
  align-items: stretch;
}

.panel {
  width: 460px;
  padding: 28px 32px 32px;
  background: var(--dm-panel);
  border-top: 3px solid var(--dm-cyan);
  border-bottom: 1px solid var(--dm-cyan-dim);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel h2 {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 34px;
  letter-spacing: 0.08em;
  border-left: 5px solid var(--dm-cyan);
  padding-left: 14px;
}

.subtitle {
  margin: 4px 0 0;
  line-height: 1.5;
  color: var(--dm-muted);
}

.center {
  /* the global .center pins elements to the screen center — keep this one in the panel flow */
  position: static;
  transform: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
}

.speed-value {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 96px;
  line-height: 1;
  color: #ffffff;
  text-shadow: 0 0 18px rgba(25, 211, 255, 0.55);
}

.actions {
  margin-top: 6px;
  display: flex;
  gap: 14px;
}

.actions button {
  min-width: 150px;
  padding: 12px 26px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-text);
  background: transparent;
  cursor: pointer;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
  transition: filter 0.15s, background 0.15s;
}

.actions button:hover {
  background: var(--dm-cyan-faint);
}

.actions button:first-child {
  color: #04121c;
  background: var(--dm-cyan);
  border-color: var(--dm-cyan);
}

.actions button:first-child:hover {
  filter: brightness(1.18);
}

.hint {
  margin-top: 4px;
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.1em;
  color: var(--dm-muted);
}

/* ---------- preview lane ---------- */
.preview {
  width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lane {
  width: 84px;
  height: 100%;
  min-height: 380px;
  background: linear-gradient(180deg, rgba(4, 8, 16, 0.85), rgba(25, 211, 255, 0.1));
  border-left: 2px solid var(--dm-cyan);
  border-right: 2px solid var(--dm-cyan);
  box-shadow: 0 0 16px rgba(25, 211, 255, 0.3);
  position: relative;
  overflow: hidden;
}

.lane::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 12%;
  height: 3px;
  background: #ffffff;
  box-shadow: 0 0 10px var(--dm-cyan);
}

.note {
  position: absolute;
  width: 68px;
  height: 14px;
  background: var(--dm-cyan);
  box-shadow: inset 0 3px 0 #c4f5ff, inset 0 -2px 0 #ffffff;
  transform: translateX(-50%);
  top: -10%;
  left: 50%;
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-duration: calc(2.8s / var(--speed));
}

@keyframes fall {
  0% { top: -12%; opacity: 0; }
  6% { opacity: 1; }
  80% { top: 88%; opacity: 1; }
  100% { top: 110%; opacity: 0; }
}
</style>
