<template>
  <div class="demo-game">
    <canvas ref="gameCanvas" class="demo-canvas"></canvas>
    <div class="demo-overlay">
      <div class="info">Demo: Set speed, then press Start. Press D when the note reaches the judgment line.</div>
      <div style="margin-top:8px">
        <button @click="startGame" :disabled="started">Start</button>
        <button @click="stopGame" :disabled="!started">Stop</button>
      </div>
      <div class="judge-text">{{ judgeText }}</div>
    </div>
  </div>
</template>

<script>
import GameInstance from "../gameInstance";
import Track from "../track";

export default {
  name: "DemoGame",
  components: {},
  data() {
    return {
      gameInstance: null,
      track: null,
      judgeText: "",
      canvas: null,
      ctx: null,
      noteSpawned: false,
      started: false,
      baseNoteSpeed: 560,
      };
  },
  async mounted() {
    this.canvas = this.$refs.gameCanvas;
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();

    // Do not create gameInstance/track until user starts the demo. Only wire input and resize.
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resizeCanvas);
  },
  beforeDestroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.resizeCanvas);
    if (this.gameInstance) {
      this.gameInstance.pause();
    }
  },
  methods: {
    resizeCanvas() {
      if (!this.canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(window.innerWidth, 600);
      const height = Math.max(window.innerHeight, 360);
      this.canvas.width = Math.floor(width * ratio);
      this.canvas.height = Math.floor(height * ratio);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (this.track) {
        this.track.x = Math.round(width / 2 - 90);
        this.track.height = height;
        this.track.judgeLineY = Math.round(height * 0.82);
      }
    },
    onGameTick({ dt }) {
      if (!this.track) return;
      this.track.update(dt);
      this.drawFrame();
    },
    drawFrame() {
      const ctx = this.ctx;
      const width = this.canvas.width / (window.devicePixelRatio || 1);
      const height = this.canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#080a10";
      ctx.fillRect(0, 0, width, height);
      this.track.render();
    },
    onKeyDown(event) {
      if (this.track) this.track.handleKeyDown(event.key);
    },
    onKeyUp(event) {
      if (this.track) this.track.handleKeyUp(event.key);
    },
    handleJudge(payload) {
      this.judgeText = payload.judge;
      window.clearTimeout(this._judgeTimeout);
      this._judgeTimeout = window.setTimeout(() => {
        this.judgeText = "";
      }, 600);
    },
    async startGame() {
      if (this.started) return;
      this.started = true;
      // create GameInstance and Track with immutable speedMultiplier from store
      const multiplier = this.$store?.state?.speedMultiplier || 1.0;
      this.gameInstance = new GameInstance({
        audioSrc: "/audio/effects/ta.mp3",
        onTick: this.onGameTick,
        speedMultiplier: multiplier,
      });

      // baseNoteSpeed * multiplier -> fixed speedPxPerSec for the session
      const speedPxPerSec = this.baseNoteSpeed * multiplier;

      this.track = new Track(this.ctx, {
        x: Math.round((this.canvas.width / (window.devicePixelRatio || 1)) / 2 - 90),
        width: 180,
        judgeLineY: Math.round((this.canvas.height / (window.devicePixelRatio || 1)) * 0.82),
        keyBind: "d",
        speedPxPerSec,
        onJudge: this.handleJudge,
      });

      await this.gameInstance.load();
      this.track.spawnNote();
      this.noteSpawned = true;
      this.gameInstance.play();
    },
    stopGame() {
      if (!this.started) return;
      this.started = false;
      if (this.gameInstance) this.gameInstance.stop();
      this.gameInstance = null;
      this.track = null;
      this.judgeText = "";
      this.noteSpawned = false;
    },
  },
};
</script>

<style scoped>
.demo-game {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #080a10;
  overflow: hidden;
}

.demo-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.demo-overlay {
  position: absolute;
  left: 18px;
  top: 18px;
  color: #e8f8ff;
  font-family: Arial, sans-serif;
  z-index: 10;
}

.info {
  font-size: 14px;
  margin-bottom: 8px;
}

.judge-text {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
