<template>
  <transition name="loading-screen">
    <div class="loading-screen" v-if="show">
      <div class="ls-bg" :style="bgStyle"></div>
      <div class="ls-lines"></div>
      <div class="ls-shade"></div>

      <div class="ls-content">
        <div class="ls-jacket-frame">
          <div class="ls-jacket">
            <img v-if="cover" :src="cover" class="ls-art" />
            <div v-else class="ls-art ls-art-empty"></div>
          </div>
        </div>

        <div class="ls-info">
          <div class="ls-label"><span class="slashes">///</span> NOW LOADING</div>
          <h1 class="ls-title">{{ title }}</h1>
          <p class="ls-artist">{{ artist }}</p>

          <div class="ls-chips" v-if="chips.length">
            <span class="ls-chip" v-for="chip in chips" :key="chip.label">
              <small>{{ chip.label }}</small>{{ chip.value }}
            </span>
          </div>

          <div class="ls-keys">
            <span class="key outer">{{ displayKeys[0] }}</span>
            <span class="key inner">{{ displayKeys[1] }}</span>
            <span class="key inner">{{ displayKeys[2] }}</span>
            <span class="key outer">{{ displayKeys[3] }}</span>
          </div>
        </div>
      </div>

      <div class="ls-progress">
        <div class="ls-progress-fill"></div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: "GameLoadingScreen",
  props: {
    show: { type: Boolean, default: false },
    song: { type: Object, default: null },
  },
  computed: {
    // `song` is the chart; the song's own info (title/artist/cover/bpm) lives in chart.song
    base() {
      return (this.song && (this.song.song || this.song)) || {};
    },
    cover() {
      return this.base.customCoverUrl || (this.song && this.song.customCoverUrl) || "";
    },
    title() {
      return this.base.title || "";
    },
    artist() {
      return this.base.artist || this.base.subtitle || "";
    },
    bgStyle() {
      return this.cover ? { backgroundImage: `url(${this.cover})` } : {};
    },
    chips() {
      const s = this.song;
      if (!s) return [];
      const out = [];
      const keys = String(Array.isArray(s.keys) ? s.keys[0] : s.keys ?? "").replace(/\D/g, "");
      if (keys) out.push({ label: "MODE", value: `${keys}B` });
      if (s.difficulty) out.push({ label: "LV", value: s.difficulty });
      if (this.base.bpm) out.push({ label: "BPM", value: this.base.bpm });
      return out;
    },
    displayKeys() {
      const defaultBind = ["d", "f", "j", "k"];
      const keyMap = this.$store.state?.userProfile?.preference?.keyMap;
      return defaultBind.map((defKey) => {
        const mapped = keyMap && keyMap[defKey];
        const key = typeof mapped === "string" && mapped ? mapped : defKey;
        return key.toUpperCase();
      });
    },
  },
};
</script>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 700;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: var(--dm-font-body);
  overflow: hidden;
}

.ls-bg {
  position: absolute;
  top: -8%;
  left: -8%;
  width: 116%;
  height: 116%;
  background-size: cover;
  background-position: center;
  filter: blur(30px) brightness(0.28) saturate(0.85);
}

.ls-lines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    115deg,
    rgba(25, 211, 255, 0.05) 0,
    rgba(25, 211, 255, 0.05) 1px,
    transparent 1px,
    transparent 16px
  );
}

.ls-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(4, 6, 12, 0.85), rgba(4, 6, 12, 0.35) 60%, rgba(4, 6, 12, 0.8));
}

.ls-content {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 64px;
  padding: 0 8vw 60px;
  box-sizing: border-box;
}

.ls-jacket-frame {
  flex: 0 0 auto;
  width: min(34vw, 46vh);
  aspect-ratio: 1 / 1;
  padding: 2px;
  background: linear-gradient(135deg, var(--dm-cyan) 0%, rgba(25, 211, 255, 0.15) 45%, var(--dm-cyan) 100%);
  clip-path: polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 34px 100%, 0 calc(100% - 34px));
}

.ls-jacket {
  width: 100%;
  height: 100%;
  background: #000;
  clip-path: polygon(0 0, calc(100% - 33px) 0, 100% 33px, 100% 100%, 33px 100%, 0 calc(100% - 33px));
}

.ls-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ls-art-empty {
  background: linear-gradient(135deg, #0b1a2c, #04060c);
}

.ls-info {
  min-width: 0;
  max-width: 720px;
  border-left: 5px solid var(--dm-cyan);
  padding-left: 26px;
}

.ls-label {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 24px;
  letter-spacing: 0.3em;
  color: var(--dm-muted);
  animation: ls-blink 1.2s ease-in-out infinite;
}

.ls-label .slashes {
  color: var(--dm-cyan);
  letter-spacing: -0.05em;
}

.ls-title {
  margin: 10px 0 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(48px, 9vh, 96px);
  line-height: 0.96;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.ls-artist {
  margin: 10px 0 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 600;
  font-size: 28px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dm-cyan);
}

.ls-chips {
  display: flex;
  gap: 12px;
  margin-top: 26px;
}

.ls-chip {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 22px 6px 16px;
  background: rgba(8, 16, 30, 0.85);
  border-left: 3px solid var(--dm-cyan);
  clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 30px;
}

.ls-chip small {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--dm-muted);
}

.ls-keys {
  display: flex;
  gap: 8px;
  margin-top: 30px;
}

.ls-keys .key {
  width: 54px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  color: #04121c;
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}

.ls-keys .outer {
  background: #dcefff;
}

.ls-keys .inner {
  background: var(--dm-cyan);
}

.ls-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 6px;
  background: rgba(25, 211, 255, 0.12);
}

.ls-progress-fill {
  height: 100%;
  width: 0;
  background: var(--dm-cyan);
  box-shadow: 0 0 14px var(--dm-cyan);
  animation: ls-fill 1.6s cubic-bezier(0.25, 0.7, 0.3, 1) forwards;
}

@keyframes ls-fill {
  from {
    width: 0;
  }
  to {
    width: 94%;
  }
}

@keyframes ls-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.loading-screen-enter-active {
  transition: opacity 0.15s;
}

.loading-screen-leave-active {
  transition: opacity 0.45s ease;
}

.loading-screen-enter,
.loading-screen-leave-to {
  opacity: 0;
}
</style>
