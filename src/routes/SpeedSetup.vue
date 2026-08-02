<template>
  <div class="speed-setup">
    <div class="container" :style="{'--speed': speed}">
      <div class="panel">
        <h2>Speed Configuration</h2>
        <p class="subtitle">Set the play speed before starting. Use keys 1 (decrease) and 2 (increase).</p>

        <div class="center" role="region" aria-label="speed-controls">
          <!-- Slider removed per requirements; keyboard controls used instead -->
          <div class="speed-value">{{ formattedSpeed }}x</div>

          <div class="actions">
            <button @click="startGame">Start Game</button>
            <button @click="cancel">Cancel</button>
          </div>

          <div class="hint">Press 1 / 2 to decrease/increase speed (min 1.0, max 9.9)</div>
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
    return { speed: this.$store.state.speedMultiplier || 1.0 };
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
      // clear pending
      this.$store.commit('setPendingSheetId', null);
      this.$router.push(`/game/${sheetId}`);
    },
    cancel() {
      this.$store.commit('setPendingSheetId', null);
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
  display:flex;
  align-items:center;
  justify-content:center;
  height:100vh;
  background: linear-gradient(180deg,#07111a,#071a1f);
  color:#e8f8ff;
}

/* container holds left panel and right preview side-by-side */
.container {
  display:flex;
  gap:28px; /* explicit gap between panel and preview */
  align-items:flex-start;
}

.panel{
  width:420px; /* slightly narrower to make room for preview */
  background: rgba(0,0,0,0.6);
  padding:24px;
  border-radius:8px;
  box-shadow:0 8px 30px rgba(0,0,0,0.6);
  display:flex;
  flex-direction:column;
  gap:12px; /* ensure clean vertical spacing */
}

.subtitle{opacity:0.85;margin:0}

.center{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:12px; /* space between elements to avoid overlap */
  margin-top:6px;
}

.speed-value{
  font-size:26px;
  margin-top:4px;
  font-weight:600;
}

.actions{
  margin-top:8px;
  display:flex;
  gap:12px; /* use gap for consistent spacing */
}
.actions button{
  padding:10px 18px;
  border-radius:6px;
  background:#00d4ff;
  border:none;
  color:#002;
  cursor:pointer;
}

.hint{
  margin-top:6px;
  font-size:12px;
  color:rgba(232,248,255,0.6);
}

/* Preview area */
.preview{
  width:140px;
  display:flex;
  align-items:center;
  justify-content:center;
}

.lane{
  width:72px;
  height:420px;
  background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
  border:1px solid rgba(255,255,255,0.04);
  border-radius:6px;
  position:relative;
  overflow:hidden;
  box-shadow: inset 0 0 12px rgba(0,0,0,0.6);
}

/* Note appearance: small pill that falls from top to bottom */
.note{
  position:absolute;
  width:18px;
  height:18px;
  background: linear-gradient(180deg,#00d4ff,#00a6cc);
  border-radius:4px;
  transform: translateX(-50%);
  top:-10%;
  left:50%;
  /* animation duration scales with speed: baseTime / speed */
  /* baseTime chosen as 2.8s for pleasant preview; larger speed => shorter duration */
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-duration: calc(2.8s / var(--speed));
}

@keyframes fall {
  0% { top: -12%; opacity: 0; transform: translateX(-50%) scale(0.9); }
  6% { opacity: 1; }
  80% { top: 88%; opacity: 1; transform: translateX(-50%) scale(1); }
  100% { top: 110%; opacity: 0; transform: translateX(-50%) scale(0.95); }
}

/* Keep design aligned to minimal dark theme */
</style>