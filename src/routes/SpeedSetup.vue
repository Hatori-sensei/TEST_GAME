<template>
  <div class="speed-setup">
    <div class="panel">
      <h2>Speed Configuration</h2>
      <p class="subtitle">Set the play speed before starting. In-game speed changes are disabled.</p>
      <div class="center">
        <input type="range" min="0.5" max="5.0" step="0.1" v-model.number="speed" />
        <div class="speed-value">{{ speed.toFixed(1) }}x</div>
        <div class="actions">
          <button @click="startGame">Start Game</button>
          <button @click="cancel">Cancel</button>
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
  mounted() {
    // If arrived without a pending sheet, redirect to menu
    const sheetId = this.$route.params.sheet;
    if (!sheetId && !this.$store.state.pendingSheetId) {
      this.$router.push('/menu');
    }
  },
  methods: {
    startGame() {
      const sheetId = this.$route.params.sheet || this.$store.state.pendingSheetId;
      this.$store.commit('setSpeedMultiplier', this.speed);
      // clear pending
      this.$store.commit('setPendingSheetId', null);
      this.$router.push(`/game/${sheetId}`);
    },
    cancel() {
      this.$store.commit('setPendingSheetId', null);
      this.$router.push('/menu');
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
.panel{
  width:520px;
  background: rgba(0,0,0,0.6);
  padding:30px;
  border-radius:8px;
  text-align:center;
  box-shadow:0 8px 30px rgba(0,0,0,0.6);
}
.subtitle{opacity:0.8;margin-bottom:20px}
.center{display:flex;flex-direction:column;align-items:center}
.speed-value{font-size:22px;margin-top:8px}
.actions{margin-top:20px}
.actions button{margin:0 8px;padding:10px 18px;border-radius:6px;background:#00d4ff;border:none;color:#002;cursor:pointer}
</style>