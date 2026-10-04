<template>
  <div class="song-select-page">
    <div class="bg-blur" :style="{ backgroundImage: bgImage }"></div>
    <div class="bg-lines"></div>
    <div class="bg-vignette"></div>

    <header class="top-bar">
      <div class="top-title">
        <span class="slashes">///</span>
        <span>MUSIC SELECT</span>
      </div>
      <div class="top-hint">
        <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> SELECT</span>
        <span><kbd>ENTER</kbd> START</span>
        <span><kbd>ESC</kbd> OPTIONS</span>
      </div>
    </header>

    <div class="layout-container">
      <section class="left-panel">
        <transition name="fade" mode="out-in">
          <div class="song-info" v-if="selectedSong" :key="selectedSong.id">
            <div class="jacket-frame" :style="jacketStyle">
              <div class="jacket">
                <img :src="coverImage" class="album-art" @load="onArtLoad" />
                <div class="album-overlay"></div>
              </div>
            </div>

            <div class="title-block">
              <h1 class="song-title">{{ selectedSong.title }}</h1>
              <p class="song-artist">{{ selectedSong.artist || 'Unknown Artist' }}</p>
            </div>

            <div class="detail-grid">
              <div class="detail-card">
                <span class="label">BPM</span>
                <strong>{{ selectedSongBpm }}</strong>
              </div>
              <div class="detail-card">
                <span class="label">LENGTH</span>
                <strong>{{ selectedSongLength }}</strong>
              </div>
            </div>

            <div class="play-panel" v-if="sheetList && sheetList.length > 0">
              <button class="play-action" @click="playGame(sheetList[0].id)">
                <span class="play-mode">{{ String(sheetList[0].keys).replace(/\D/g, '') }}B</span>
                <span class="play-lv"><small>LV</small>{{ sheetList[0].difficulty }}</span>
                <span class="play-go">START<i class="chev"></i></span>
              </button>
            </div>
            <Loading v-else :show="true" text="Loading Sheets..." />
          </div>

          <div v-else class="empty-state">
            Loading Songs...
          </div>
        </transition>
      </section>

      <section class="right-panel">
        <div class="list-head">
          <span class="list-title">TRACK LIST</span>
          <span class="list-count">{{ String((songList || []).length).padStart(2, '0') }}</span>
        </div>

        <div class="list-container" ref="listContainer">
          <div
            v-for="(song, index) in songList"
            :key="song.id"
            class="song-item"
            :class="{ active: selectedIndex === index }"
            @click="selectSong(index, false)"
            @mouseenter="hoverSong(index)"
          >
            <span class="song-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="song-item-content">
              <span class="song-name">{{ song.title }}</span>
              <span class="song-subtitle">{{ song.subtitle || song.artist || 'Unknown' }}</span>
            </div>
            <div class="song-meta">
              <span class="song-lv" v-if="song.difficulty">LV {{ song.difficulty }}</span>
              <span class="song-len">{{ song.length || '00:00' }}</span>
            </div>
          </div>

          <Loading :show="!songList || songList.length === 0" text="Fetching Songs..." />
        </div>
      </section>
    </div>

    <transition name="modal-fade">
      <div
        v-if="showQuickSettings"
        class="quick-settings-backdrop"
        @click.self="closeQuickSettings"
      >
        <div class="quick-settings-panel blurBackground">
          <div class="quick-settings-header">
            <h2>설정</h2>
            <div class="hint">ESC를 눌러 닫기</div>
          </div>

          <div class="quick-settings-section">
            <h3>키,배속 설정</h3>
            <div class="settings-row">
              <label>배속</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickGameSt.noteSpeed"
                  :interval="0.1"
                  :min="1"
                  :max="9.9"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Number(val).toFixed(1)}x`"
                  @change="onQuickSpeedChange"
                ></vue-slider>
              </div>
              <strong>{{ Number(quickGameSt.noteSpeed).toFixed(1) }}x</strong>
            </div>
            <div class="settings-row">
              <label for="randomGimmickMode">랜덤 기믹 테스트</label>
              <div class="slider-wrap">
                <select
                  id="randomGimmickMode"
                  v-model="quickGameSt.randomGimmickMode"
                  @change="onRandomGimmickModeChange"
                >
                  <option value="off">끄기</option>
                  <option value="speed">변속만</option>
                  <option value="lane">레인 이동만</option>
                  <option value="both">변속 + 레인 이동</option>
                </select>
              </div>
              <strong>{{ randomGimmickModeText(quickGameSt.randomGimmickMode) }}</strong>
            </div>
            <div class="settings-row">
              <label></label>
              <Checkbox
                label="키 빔"
                :model="quickGameSt"
                modelKey="keyBeamEnabled"
                cbStyle="form"
              ></Checkbox>
            </div>
            <div class="settings-row">
              <label></label>
              <Checkbox
                label="노트 타격 이펙트"
                :model="quickGameSt"
                modelKey="noteEffectEnabled"
                cbStyle="form"
              ></Checkbox>
            </div>
            <KeyMappings v-model="quickPreference.keyMap"></KeyMappings>
          </div>

          <div class="quick-settings-section">
            <h3>사운드 설정</h3>
            <div class="settings-row">
              <label>BGM</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickSound.bgmVolume"
                  :interval="0.01"
                  :min="0"
                  :max="1"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Math.round(Number(val) * 100)}%`"
                  @change="onBgmVolumeChange"
                ></vue-slider>
              </div>
              <strong>{{ Math.round(quickSound.bgmVolume * 100) }}%</strong>
            </div>
            <div class="settings-row">
              <label>효과음</label>
              <div class="slider-wrap">
                <vue-slider
                  :value="quickSound.effectVolume"
                  :interval="0.01"
                  :min="0"
                  :max="1"
                  :contained="true"
                  :tooltip-formatter="(val) => `${Math.round(Number(val) * 100)}%`"
                  @change="onEffectVolumeChange"
                ></vue-slider>
              </div>
              <strong>{{ Math.round(quickSound.effectVolume * 100) }}%</strong>
            </div>
          </div>

          <div class="quick-settings-actions">
            <button class="settings-btn save" @click="saveQuickSettings">Apply</button>
            <button class="settings-btn" @click="closeQuickSettings">Close</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import Loading from "../components/ui/Loading.vue";
import KeyMappings from "../components/menus/KeyMappings.vue";
import Checkbox from "../components/ui/Checkbox.vue";
import VueSlider from "vue-slider-component";
import { getSheetList, getSongListCached, updateUserProfile } from "../javascript/db";
import { logEvent } from "../helpers/analytics";
import { resolveSongPreviewRange } from "../javascript/localCatalog";

const DEFAULT_KEY_MAP = {
  a: "a",
  s: "s",
  d: "d",
  f: "f",
  " ": " ",
  j: "j",
  k: "k",
  l: "l",
  ";": ";",
};

export default {
  name: "SongSelect",
  components: { Loading, KeyMappings, VueSlider, Checkbox },
  data() {
    return {
      artRatio: 1,
      allSongs: null,
      songList: [],
      sheetList: null,
      selectedSong: null,
      selectedIndex: 0,
      previewStopTimer: null,
      previewFadeOutTimer: null,
      previewToken: 0,
      showQuickSettings: false,
      quickGameSt: {
        noteSpeed: 1,
        randomGimmickMode: "off",
        keyBeamEnabled: true,
        noteEffectEnabled: true,
      },
      quickPreference: {
        keyMap: { ...DEFAULT_KEY_MAP },
      },
      quickSound: {
        bgmVolume: 0.7,
        effectVolume: 0.5,
      },
    };
  },
  computed: {
    jacketStyle() {
      const r = this.artRatio > 0 ? this.artRatio : 1;
      return { width: `min(100%, calc(44vh * ${r}))`, aspectRatio: String(r) };
    },
    coverImage() {
      if (!this.selectedSong) return '';
      if (this.selectedSong.customCoverUrl) return this.selectedSong.customCoverUrl;
      if (this.selectedSong.srcMode === 'youtube' && this.selectedSong.youtubeId) {
        return `https://img.youtube.com/vi/${this.selectedSong.youtubeId}/hqdefault.jpg`;
      }
      return 'assets/default-cover.png';
    },
    bgImage() {
      return this.coverImage ? `url(${this.coverImage})` : 'none';
    },
    selectedSongBpm() {
      const bpm = this.selectedSong?.bpm;
      if (typeof bpm === "number") return String(Math.round(bpm));
      if (typeof bpm === "string" && bpm.trim()) return bpm;
      return "120";
    },
    selectedSongLength() {
      const length = this.selectedSong?.length;
      if (typeof length === "number" && Number.isFinite(length)) {
        const minutes = Math.floor(length / 60);
        const seconds = Math.floor(length % 60)
          .toString()
          .padStart(2, "0");
        return `${minutes}:${seconds}`;
      }
      if (typeof length === "string" && length.trim()) return length;
      const duration = this.selectedSong?.duration;
      if (typeof duration === "string" && duration.trim()) return duration;
      return "0:00";
    }
  },
  watch: {
    async selectedSong() {
      this.sheetList = null;
      if (this.selectedSong) {
        this.sheetList = await getSheetList(this.selectedSong.id);
        logEvent("song_selected", { id: this.selectedSong.id });
        this.playSelectedSongPreview(this.selectedSong);
      }
    },
  },
  async mounted() {
    await this.getAllSongs();
    this.songList = this.allSongs || [];
    this.selectSong(0);
    this.initQuickSettings();
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    this.clearPreviewTimer();
    window.removeEventListener('keydown', this.handleKeydown);
  },
  deactivated() {
    this.clearPreviewTimer();
  },
  methods: {
    initQuickSettings() {
      const profile = this.$store.state.userProfile || {};
      const gameSt = profile.gameSt || {};
      const preference = profile.preference || {};
      const audio = this.$store.state.audio;

      const speed = Number(gameSt.noteSpeed ?? this.$store.state.speedMultiplier ?? 1);
      this.quickGameSt.noteSpeed = this.clamp(speed, 1, 9.9, 1);
      this.quickGameSt.randomGimmickMode = this.normalizeRandomGimmickMode(
        this.$store.state.randomGimmickMode
      );
      this.quickGameSt.keyBeamEnabled = gameSt.keyBeamEnabled ?? true;
      this.quickGameSt.noteEffectEnabled = gameSt.noteEffectEnabled ?? true;
      this.quickPreference.keyMap = {
        ...DEFAULT_KEY_MAP,
        ...(preference.keyMap || {}),
      };

      const bgmVolume = Number(audio?.maxVolume ?? 0.7);
      const effectVolume = Number(audio?.effectVolume ?? 0.5);
      this.quickSound.bgmVolume = this.clamp(bgmVolume, 0, 1, 0.7);
      this.quickSound.effectVolume = this.clamp(effectVolume, 0, 1, 0.5);
    },
    clamp(value, min, max, fallback) {
      const num = Number(value);
      if (!Number.isFinite(num)) return fallback;
      return Math.min(max, Math.max(min, num));
    },
    openQuickSettings() {
      this.initQuickSettings();
      this.showQuickSettings = true;
      this.$store.state.audio.playEffect("ui/pop");
    },
    closeQuickSettings() {
      this.showQuickSettings = false;
      this.$store.state.audio.playEffect("ui/loose");
    },
    onQuickSpeedChange(value) {
      this.quickGameSt.noteSpeed = this.clamp(value, 1, 9.9, 1);
    },
    normalizeRandomGimmickMode(mode) {
      const normalized = String(mode || "off").toLowerCase();
      const allowed = ["off", "speed", "lane", "both"];
      return allowed.includes(normalized) ? normalized : "off";
    },
    randomGimmickModeText(mode) {
      const normalized = this.normalizeRandomGimmickMode(mode);
      if (normalized === "speed") return "변속만";
      if (normalized === "lane") return "레인만";
      if (normalized === "both") return "둘 다";
      return "끄기";
    },
    onRandomGimmickModeChange() {
      this.$store.commit(
        "setRandomGimmickMode",
        this.normalizeRandomGimmickMode(this.quickGameSt.randomGimmickMode)
      );
    },
    onBgmVolumeChange(value) {
      const next = this.clamp(value, 0, 1, 0.7);
      this.quickSound.bgmVolume = next;
      const audio = this.$store.state.audio;
      if (!audio) return;
      audio.maxVolume = next;
      audio.setVolume(next);
    },
    onEffectVolumeChange(value) {
      const next = this.clamp(value, 0, 1, 0.5);
      this.quickSound.effectVolume = next;
      const audio = this.$store.state.audio;
      if (!audio) return;
      audio.effectVolume = next;
      audio.playEffect("ui/click2");
    },
    async saveQuickSettings() {
      const profile = this.$store.state.userProfile || {};
      const gameSt = {
        ...(profile.gameSt || {}),
        noteSpeed: this.quickGameSt.noteSpeed,
        keyBeamEnabled: this.quickGameSt.keyBeamEnabled,
        noteEffectEnabled: this.quickGameSt.noteEffectEnabled,
      };
      const preference = {
        ...(profile.preference || {}),
        keyMap: { ...this.quickPreference.keyMap },
      };

      this.$store.commit("setSpeedMultiplier", this.quickGameSt.noteSpeed);
      this.$store.commit(
        "setRandomGimmickMode",
        this.normalizeRandomGimmickMode(this.quickGameSt.randomGimmickMode)
      );
      this.$store.commit("setUserProfile", {
        ...profile,
        gameSt,
        preference,
      });

      try {
        await updateUserProfile({ gameSt, preference });
      } catch (error) {
        Logger.warn("quick settings save failed", error);
      }

      this.$store.state.audio.playEffect("ui/slide2");
      this.showQuickSettings = false;
    },
    clearPreviewTimer() {
      if (this.previewStopTimer) {
        clearTimeout(this.previewStopTimer);
        this.previewStopTimer = null;
      }
      if (this.previewFadeOutTimer) {
        clearTimeout(this.previewFadeOutTimer);
        this.previewFadeOutTimer = null;
      }
    },
    getSongPreviewRange(song) {
      return resolveSongPreviewRange(song, 60);
    },
    async playSelectedSongPreview(song) {
      const audio = this.$store?.state?.audio;
      if (!audio || !song) return;

      const songSrc = song.audioPath || song.url;
      if (!songSrc) return;

      this.previewToken += 1;
      const token = this.previewToken;
      this.clearPreviewTimer();

      const { startSec, durationSec } = this.getSongPreviewRange(song);
      if (durationSec <= 0) return;

      const durationMs = Math.floor(durationSec * 1000);
      const fadeMs = Math.max(250, Math.min(1200, Math.floor(durationMs / 3)));
      const fadeOutStartMs = Math.max(0, durationMs - fadeMs);
      const loopGapMs = 200;

      try {
        await audio.loadSong(songSrc, false);
        if (token !== this.previewToken) return;

        const runPreviewCycle = () => {
          if (token !== this.previewToken) return;

          audio.seek(startSec);
          audio.setVolume(0);
          audio.play();
          audio.fadeIn(fadeMs);

          this.previewFadeOutTimer = setTimeout(() => {
            if (token !== this.previewToken) return;
            audio.fadeOut(fadeMs);
          }, fadeOutStartMs);

          this.previewStopTimer = setTimeout(() => {
            if (token !== this.previewToken) return;
            audio.pause();
            this.previewStopTimer = setTimeout(() => {
              if (token !== this.previewToken) return;
              runPreviewCycle();
            }, loopGapMs);
          }, durationMs);
        };

        runPreviewCycle();
      } catch (error) {
        console.warn("Song preview load failed", error);
      }
    },
    onArtLoad(e) {
      const img = e.target;
      if (img.naturalWidth && img.naturalHeight) {
        this.artRatio = img.naturalWidth / img.naturalHeight;
      }
    },
    hoverSong(index) {
      if (this.selectedIndex !== index) {
        this.$store.state.audio.playHoverEffect("ui/ta");
      }
    },
    selectSong(index, shouldAutoScroll = true) {
      if (!this.songList || this.songList.length === 0) return;
      this.selectedIndex = index;
      this.selectedSong = this.songList[index];
      if (shouldAutoScroll) {
        this.scrollToSelected();
      }
    },
    handleKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (this.showQuickSettings) {
          this.closeQuickSettings();
        } else {
          this.openQuickSettings();
        }
        return;
      }

      if (this.showQuickSettings) return;

      if (!this.songList || this.songList.length === 0) return;


      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let next = this.selectedIndex + 1;
        if (next >= this.songList.length) next = 0;
        this.selectSong(next, true);
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        let next = this.selectedIndex - 1;
        if (next < 0) next = this.songList.length - 1;
        this.selectSong(next, true);
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.sheetList && this.sheetList.length > 0) {
          this.playGame(this.sheetList[0].id);
        }
      }
    },
    scrollToSelected() {
      this.$nextTick(() => {
        const container = this.$refs.listContainer;
        if (!container) return;
        const activeEl = container.querySelector('.song-item.active');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      });
    },
    playGame(sheetId) {
      // Route to speed setup step before actual game start
      this.$store.commit('setPendingSheetId', sheetId);
      const randomGimmickMode = this.normalizeRandomGimmickMode(
        this.quickGameSt.randomGimmickMode || this.$store.state.randomGimmickMode
      );
      this.$store.commit('setPendingGameOptions', {
        randomGimmickMode,
      });
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push(`/speed-setup/${sheetId}`);
    },

    async getAllSongs() {
      if (!this.allSongs) this.allSongs = await getSongListCached();
    },
  },
};
</script>

<style scoped>
.song-select-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--dm-bg);
  color: var(--dm-text);
  overflow: hidden;
  font-family: var(--dm-font-body);
}

.bg-blur {
  position: absolute;
  top: -8%;
  left: -8%;
  width: 116%;
  height: 116%;
  background-size: cover;
  background-position: center;
  filter: blur(28px) brightness(0.3) saturate(0.85);
  z-index: 0;
  transition: background-image 0.5s ease-in-out;
}

.bg-lines {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: repeating-linear-gradient(
    115deg,
    rgba(25, 211, 255, 0.05) 0,
    rgba(25, 211, 255, 0.05) 1px,
    transparent 1px,
    transparent 16px
  );
}

.bg-vignette {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(90deg, rgba(4, 6, 12, 0.92) 0%, rgba(4, 6, 12, 0.35) 45%, rgba(4, 6, 12, 0.7) 100%);
}

/* ---------- top bar ---------- */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 48px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  background: linear-gradient(180deg, rgba(4, 6, 12, 0.9), rgba(4, 6, 12, 0.4));
}

.top-title {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 0.08em;
  display: flex;
  align-items: center;
  gap: 14px;
}

.top-title .slashes {
  color: var(--dm-cyan);
  letter-spacing: -0.05em;
}

.top-hint {
  display: flex;
  gap: 26px;
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.14em;
  color: var(--dm-muted);
}

.top-hint kbd {
  display: inline-block;
  min-width: 18px;
  padding: 1px 7px;
  margin-right: 5px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-cyan);
  font-family: inherit;
  font-size: 13px;
  text-align: center;
}

/* ---------- layout ---------- */
.layout-container {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  padding: 96px 48px 40px;
  gap: 56px;
  box-sizing: border-box;
}

.left-panel {
  flex: 0 0 min(46%, 640px);
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.right-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ---------- jacket ---------- */
.song-info {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 0;
}

.jacket-frame {
  /* width / aspect-ratio come from the image's real size (see jacketStyle) */
  width: min(100%, 44vh);
  padding: 2px;
  background: linear-gradient(135deg, var(--dm-cyan) 0%, rgba(25, 211, 255, 0.15) 45%, var(--dm-cyan) 100%);
  clip-path: polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 34px 100%, 0 calc(100% - 34px));
}

.jacket {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  clip-path: polygon(0 0, calc(100% - 33px) 0, 100% 33px, 100% 100%, 33px 100%, 0 calc(100% - 33px));
}

.album-art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, rgba(4, 6, 12, 0.55));
}

/* ---------- title ---------- */
.title-block {
  border-left: 5px solid var(--dm-cyan);
  padding-left: 18px;
}

.song-title {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(38px, 6.4vh, 68px);
  line-height: 0.98;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.song-artist {
  margin: 8px 0 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 600;
  font-size: 24px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dm-cyan);
}

/* ---------- stats ---------- */
.detail-grid {
  display: flex;
  gap: 14px;
  max-width: 560px;
}

.detail-card {
  flex: 1;
  padding: 8px 16px 8px 18px;
  background: rgba(8, 16, 30, 0.82);
  border-left: 3px solid var(--dm-cyan);
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
}

.detail-card .label {
  display: block;
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.24em;
  color: var(--dm-muted);
}

.detail-card strong {
  display: block;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 36px;
  line-height: 1.05;
}

/* ---------- start button ---------- */
.play-panel {
  margin-top: 4px;
}

.play-action {
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 560px;
  height: 72px;
  padding: 0;
  border: 0;
  cursor: pointer;
  color: #04121c;
  background: var(--dm-cyan);
  clip-path: polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%);
  font-family: var(--dm-font-display);
  transition: filter 0.15s;
}

.play-action:hover {
  filter: brightness(1.18);
}

.play-mode,
.play-lv {
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: italic;
  font-weight: 800;
  font-size: 34px;
  color: #eaf6ff;
  background: #071a2b;
}

.play-mode {
  padding: 0 18px 0 34px;
  color: var(--dm-cyan);
}

.play-lv {
  padding: 0 34px 0 22px;
  color: var(--dm-amber);
  gap: 6px;
  border-left: 1px solid rgba(25, 211, 255, 0.25);
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
  margin-right: -14px;
}

.play-lv small {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--dm-muted);
  align-self: flex-end;
  padding-bottom: 14px;
}

.play-go {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding-left: 12px;
  font-style: italic;
  font-weight: 800;
  font-size: 38px;
  letter-spacing: 0.12em;
}

.play-go .chev {
  width: 0;
  height: 0;
  border-top: 11px solid transparent;
  border-bottom: 11px solid transparent;
  border-left: 16px solid #04121c;
}

.empty-state {
  font-family: var(--dm-font-display);
  font-size: 22px;
  letter-spacing: 0.2em;
  color: var(--dm-muted);
}

/* ---------- track list ---------- */
.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 0 10px 26px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--dm-cyan-dim);
  font-family: var(--dm-font-display);
  font-weight: 700;
  letter-spacing: 0.24em;
  color: var(--dm-muted);
}

.list-title {
  font-size: 16px;
}

.list-count {
  font-size: 22px;
  color: var(--dm-cyan);
  letter-spacing: 0.1em;
}

.list-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 6px 4px 34px;
  margin-left: -34px;
}

.list-container::-webkit-scrollbar {
  width: 4px;
}

.list-container::-webkit-scrollbar-thumb {
  background: var(--dm-cyan-dim);
}

.song-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 66px;
  margin-bottom: 8px;
  padding: 0 40px 0 22px;
  cursor: pointer;
  background: rgba(8, 16, 30, 0.8);
  clip-path: polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
  transition: transform 0.18s ease, background 0.18s;
}

.song-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: rgba(25, 211, 255, 0.22);
  transition: background 0.18s;
}

.song-item:hover {
  background: rgba(14, 30, 52, 0.9);
}

.song-item.active {
  transform: translateX(-26px);
  background: linear-gradient(90deg, rgba(9, 26, 44, 0.96), rgba(12, 38, 62, 0.96));
}

.song-item.active::before {
  background: var(--dm-cyan);
  width: 8px;
}

.song-index {
  flex: 0 0 34px;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 26px;
  color: var(--dm-muted);
  text-align: center;
}

.song-item.active .song-index {
  color: var(--dm-cyan);
}

.song-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.song-name {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 27px;
  line-height: 1.05;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-subtitle {
  font-family: var(--dm-font-display);
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dm-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-item.active .song-subtitle {
  color: var(--dm-cyan);
}

.song-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--dm-font-display);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.song-lv {
  font-size: 18px;
  color: var(--dm-amber);
}

.song-len {
  font-size: 16px;
  color: var(--dm-muted);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-enter {
  opacity: 0;
  transform: translateX(-16px);
}

.fade-leave-to {
  opacity: 0;
}

/* ---------- quick settings popup ---------- */
.quick-settings-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(2, 4, 10, 0.78);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  box-sizing: border-box;
}

.quick-settings-panel {
  width: min(920px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px 32px;
  background: var(--dm-panel);
  border-top: 3px solid var(--dm-cyan);
  border-bottom: 1px solid var(--dm-cyan-dim);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 26px), calc(100% - 26px) 100%, 0 100%);
}

.quick-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.quick-settings-header h2 {
  margin: 0;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 32px;
  letter-spacing: 0.08em;
}

.quick-settings-header .hint {
  font-family: var(--dm-font-display);
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--dm-muted);
}

.quick-settings-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--dm-cyan-dim);
}

.quick-settings-section h3 {
  margin: 0 0 10px;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.1em;
  color: var(--dm-cyan);
}

.settings-row {
  display: grid;
  grid-template-columns: 160px 1fr 80px;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.settings-row label {
  font-weight: 500;
  color: var(--dm-muted);
}

.settings-row strong {
  font-family: var(--dm-font-display);
  font-style: italic;
  font-size: 22px;
  text-align: right;
}

.slider-wrap {
  min-width: 0;
}

.slider-wrap select {
  width: 100%;
  padding: 8px 10px;
  color: var(--dm-text);
  background: #071a2b;
  border: 1px solid var(--dm-cyan-dim);
  border-radius: 0;
  font-family: var(--dm-font-body);
}

.quick-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 22px;
}

.settings-btn {
  min-width: 120px;
  padding: 10px 26px;
  border: 1px solid var(--dm-cyan-dim);
  color: var(--dm-text);
  background: transparent;
  cursor: pointer;
  font-family: var(--dm-font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
}

.settings-btn:hover {
  background: var(--dm-cyan-faint);
}

.settings-btn.save {
  color: #04121c;
  background: var(--dm-cyan);
  border-color: var(--dm-cyan);
}

@media only screen and (max-width: 1000px) {
  .layout-container {
    flex-direction: column;
    overflow-y: auto;
    gap: 28px;
  }

  .left-panel {
    flex: none;
  }

  .top-hint {
    display: none;
  }
}
</style>
