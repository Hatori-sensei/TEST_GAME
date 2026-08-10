<template>
  <div class="song-select-page">
    <div class="bg-blur" :style="{ backgroundImage: bgImage }"></div>

    <div class="layout-container">
      <div class="left-panel">
        <div class="panel-head">
          <span>Now Playing</span>
          <h2>Track Details</h2>
        </div>

        <transition name="fade" mode="out-in">
          <div class="song-info" v-if="selectedSong" :key="selectedSong.id">
            <div class="album-art-wrapper">
              <img :src="coverImage" class="album-art" />
              <div class="album-overlay"></div>
            </div>

            <h1 class="song-title">{{ selectedSong.title }}</h1>
            <p class="song-artist">{{ selectedSong.artist || 'Unknown Artist' }}</p>

            <div class="detail-grid">
              <div class="detail-card">
                <span class="label">BPM</span>
                <strong>{{ selectedSongBpm }}</strong>
              </div>
              <div class="detail-card">
                <span class="label">Length</span>
                <strong>{{ selectedSongLength }}</strong>
              </div>
            </div>

            <div class="play-panel" v-if="sheetList && sheetList.length > 0">
              <button class="play-action" @click="playGame(sheetList[0].id)">
                <span>{{ sheetList[0].keys }}K · Lv.{{ sheetList[0].difficulty }}</span>
                <small>START</small>
              </button>
            </div>
            <Loading v-else :show="true" text="Loading Sheets..." />
          </div>

          <div v-else class="empty-state">
            Loading Songs...
          </div>
        </transition>
      </div>

      <div class="right-panel">
        <div class="panel-head">
          <span>Song Select</span>
          <h2>Choose a Track</h2>
        </div>

        <div class="tabs">
          <div class="tab active">All Songs</div>
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
            <div class="song-item-content">
              <span class="song-name">{{ song.title }}</span>
              <span class="song-subtitle">{{ song.subtitle || song.artist || 'Unknown' }}</span>
            </div>
            <div class="song-meta">
              <span>{{ song.difficulty ? 'Lv.' + song.difficulty : '—' }}</span>
              <span>{{ song.length || '00:00' }}</span>
            </div>
          </div>

          <Loading :show="!songList || songList.length === 0" text="Fetching Songs..." />
        </div>
      </div>
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
  components: { Loading, KeyMappings, VueSlider },
  data() {
    return {
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
  background: radial-gradient(circle at 20% 20%, rgba(7, 129, 255, 0.22), transparent 18%),
    radial-gradient(circle at 85% 30%, rgba(162, 52, 255, 0.18), transparent 20%),
    #05040d;
  color: #f5f8ff;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.bg-blur {
  position: absolute;
  top: -10%;
  left: -10%;
  width: 120%;
  height: 120%;
  background-size: cover;
  background-position: center;
  filter: blur(42px) brightness(0.18);
  z-index: 0;
  transition: background-image 0.5s ease-in-out;
}

.layout-container {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  padding: 40px;
  gap: 30px;
  box-sizing: border-box;
}

.quick-settings-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(4, 8, 20, 0.65);
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
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 12, 24, 0.92);
  padding: 24px;
}

.quick-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.quick-settings-header h2 {
  margin: 0;
}

.quick-settings-header .hint {
  opacity: 0.65;
  font-size: 13px;
}

.quick-settings-section {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-top: 14px;
}

.quick-settings-section h3 {
  margin: 0 0 12px;
  font-size: 17px;
}

.settings-row {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.slider-wrap {
  width: 100%;
}

.quick-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.settings-btn {
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #eef6ff;
  background: rgba(20, 34, 60, 0.8);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
}

.settings-btn.save {
  background: linear-gradient(90deg, #12a3ff, #36d6ff);
  color: #03121d;
  border-color: rgba(255, 255, 255, 0.35);
  font-weight: 700;
}

@media only screen and (max-width: 900px) {
  .quick-settings-panel {
    padding: 16px;
  }

  .settings-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

.left-panel,
.right-panel {
  min-height: calc(100vh - 80px);
  border-radius: 24px;
  overflow: hidden;
}

.left-panel {
  flex: 1.1;
  background: rgba(8, 12, 24, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 120px rgba(0, 200, 255, 0.03);
  padding: 44px;
  display: flex;
  flex-direction: column;
}

.right-panel {
  flex: 0.95;
  height: calc(100vh - 80px);
  min-height: 0;
  background: rgba(10, 14, 30, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  padding: 28px;
}

.panel-head {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  margin-bottom: 20px;
}

.panel-head span {
  color: #4fd9ff;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.panel-head h2 {
  font-size: 2rem;
  margin: 0;
  letter-spacing: -0.05em;
}

.song-info {
  width: 100%;
  max-width: 620px;
}

.album-art-wrapper {
  width: 100%;
  position: relative;
  display: block;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 13, 71, 0.5);
  margin-bottom: 32px;
}

.album-art {
  width: 100%;
  height: auto;
  display: block;
}

.album-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%);
}

.song-title {
  font-size: clamp(2.4rem, 4vw, 3.2rem);
  font-weight: 800;
  margin: 0 0 12px;
  color: #f5fbff;
  text-shadow: 0 0 20px rgba(79, 217, 255, 0.16);
}

.song-artist {
  font-size: 1rem;
  color: #a6b8ff;
  margin-bottom: 34px;
}

.detail-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 28px;
}

.detail-card {
  padding: 18px;
  border-radius: 18px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}

.detail-card .label {
  display: block;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: #84caff;
  margin-bottom: 8px;
}

.detail-card strong {
  font-size: 1rem;
  color: #eef7ff;
}

.sheet-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 18px;
}

.sheet-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(79, 217, 255, 0.16);
  padding: 16px 18px;
  border-radius: 18px;
  cursor: pointer;
  display: grid;
  gap: 10px;
  justify-items: center;
  transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
}

.sheet-btn:hover {
  background: rgba(70, 240, 255, 0.16);
  transform: translateY(-4px);
  border-color: rgba(79, 217, 255, 0.32);
}

.sheet-btn .keys {
  font-weight: 900;
  font-size: 1.3rem;
}

.sheet-btn .diff {
  font-size: 0.95rem;
  color: #d6e2ff;
}

.sheet-btn .play-text {
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  color: #c7efff;
}

.play-panel {
  margin-bottom: 28px;
}

.play-action {
  width: 100%;
  padding: 18px 22px;
  background: linear-gradient(135deg, rgba(79, 217, 255, 0.2), rgba(60, 120, 255, 0.25));
  border: 1px solid rgba(79, 217, 255, 0.45);
  border-radius: 18px;
  color: #f5fbff;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform 0.2s ease, background 0.2s ease;
}

.play-action:hover {
  transform: translateY(-2px);
  background: rgba(79, 217, 255, 0.18);
}

.play-action small {
  display: block;
  font-size: 0.75rem;
  opacity: 0.75;
}

.tabs {
  display: grid;
  grid-template-columns: 1fr;
  flex-shrink: 0;
  gap: 10px;
  padding: 14px;
  background: rgba(0, 0, 0, 0.14);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tab {
  text-align: center;
  padding: 10px 0;
  cursor: pointer;
  color: #96a6b8;
  font-weight: 700;
  border-radius: 999px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: rgba(255,255,255,0.04);
  font-size: 0.85rem;
}

.tab:hover {
  color: #eef7ff;
  background: rgba(255,255,255,0.08);
}

.tab.active {
  color: #ffffff;
  background: rgba(79, 217, 255, 0.18);
  border-color: rgba(79, 217, 255, 0.35);
}

.list-container {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-container::-webkit-scrollbar {
  width: 6px;
}

.list-container::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 999px;
}

.song-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 0;
}

.song-item:hover {
  transform: translateX(2px);
  background: rgba(255, 255, 255, 0.06);
}

.song-item.active {
  background: rgba(79, 217, 255, 0.14);
  border-color: rgba(79, 217, 255, 0.3);
  box-shadow: 0 0 18px rgba(79, 217, 255, 0.12);
}

.song-item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  color: #c4d6ff;
  font-size: 0.75rem;
}

.song-name {
  font-size: 1rem;
  font-weight: 700;
  color: #f9fcff;
}

.song-subtitle {
  font-size: 0.78rem;
  color: #b5c7ff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media only screen and (max-width: 1180px) {
  .layout-container { flex-direction: column; padding: 24px; }
  .left-panel, .right-panel { min-height: auto; }
}

@media only screen and (max-width: 820px) {
  .layout-container { gap: 16px; }
  .left-panel,
  .right-panel { width: 100%; }
  .song-title { font-size: 1.8rem; }
}
</style>