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
                <strong>{{ selectedSong.bpm || '120' }}</strong>
              </div>
              <div class="detail-card">
                <span class="label">Length</span>
                <strong>{{ selectedSong.duration || '3:24' }}</strong>
              </div>
              <div class="detail-card">
                <span class="label">Speed</span>
                <strong>{{ noteSpeed.toFixed(1) }}x</strong>
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
          <div class="tab" :class="{ active: tab === 'recom' }" @click="changeTab('recom')">Recommended</div>
          <div class="tab" :class="{ active: tab === 'new' }" @click="changeTab('new')">New</div>
          <div class="tab" :class="{ active: tab === 'all' }" @click="changeTab('all')">All Songs</div>
        </div>

        <div class="list-container" ref="listContainer">
          <div
            v-for="(song, index) in songList"
            :key="song.id"
            class="song-item"
            :class="{ active: selectedIndex === index }"
            @click="selectSong(index)"
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
  </div>
</template>

<script>
import Loading from "../components/ui/Loading.vue";
import { getSheetList, getSongListCached, getPlaylist } from "../javascript/db";
import { logEvent } from "../helpers/analytics";

export default {
  name: "SongSelect",
  components: { Loading },
  data() {
    return {
      allSongs: null,
      songList: [],
      sheetList: null,
      selectedSong: null,
      selectedIndex: 0,
      tab: "recom",
      noteSpeed: 1.0,
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
    }
  },
  watch: {
    async selectedSong() {
      this.sheetList = null;
      if (this.selectedSong) {
        this.sheetList = await getSheetList(this.selectedSong.id);
        logEvent("song_selected", { id: this.selectedSong.id });
      }
    },
    async tab() {
      if (this.tab === "recom") {
        await this.filterRecommended(true);
      } else if (this.tab === "new") {
        await this.getNewSongs();
      } else if (this.tab === "all") {
        await this.getAllSongs();
        this.songList = this.allSongs;
      }
      this.selectSong(0);
    },
  },
  mounted() {
    this.filterRecommended(true);
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeydown);
  },
  methods: {
    changeTab(tab) {
      if (this.tab !== tab) {
        this.tab = tab;
        this.$store.state.audio.playEffect("ui/slide2");
      }
    },
    hoverSong(index) {
      if (this.selectedIndex !== index) {
        this.$store.state.audio.playHoverEffect("ui/ta");
      }
    },
    selectSong(index) {
      if (!this.songList || this.songList.length === 0) return;
      this.selectedIndex = index;
      this.selectedSong = this.songList[index];
      this.scrollToSelected();
    },
    handleKeydown(e) {
      if (!this.songList || this.songList.length === 0) return;

      // 1,2 번 키로 배속 조정 (1.0x ~ 8.0x)
      if (e.keyCode === 49) { // 1 key
        e.preventDefault();
        this.noteSpeed = Math.max(1.0, this.noteSpeed - 0.1);
        this.$store.state.audio.playHoverEffect("ui/ta");
        return;
      } else if (e.keyCode === 50) { // 2 key
        e.preventDefault();
        this.noteSpeed = Math.min(8.0, this.noteSpeed + 0.1);
        this.$store.state.audio.playHoverEffect("ui/ta");
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let next = this.selectedIndex + 1;
        if (next >= this.songList.length) next = 0;
        this.selectSong(next);
        this.$store.state.audio.playHoverEffect("ui/ta");
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        let next = this.selectedIndex - 1;
        if (next < 0) next = this.songList.length - 1;
        this.selectSong(next);
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
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    },
    playGame(sheetId) {
      // 배속을 $store에 저장해서 게임에서 사용
      this.$store.state.userProfile = this.$store.state.userProfile || {};
      this.$store.state.userProfile.noteSpeed = this.noteSpeed;
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push(`/game/${sheetId}`);
    },
    async getAllSongs() {
      if (!this.allSongs) this.allSongs = await getSongListCached();
    },
    async filterRecommended(getRecommended) {
      await this.getAllSongs();
      const playlist = await getPlaylist("recommended");
      if (getRecommended) {
        this.songList = this.allSongs.filter(e => playlist.items.includes(e.id));
      } else {
        this.songList = this.allSongs.filter(e => !playlist.items.includes(e.id));
      }
      this.selectSong(0);
    },
    async getNewSongs() {
      await this.getAllSongs();
      this.songList = [...this.allSongs]
        .sort((a, b) => (b.dateUpdated?.seconds || 0) - (a.dateUpdated?.seconds || 0))
        .slice(0, 35);
      this.selectSong(0);
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
  aspect-ratio: 16/9;
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 13, 71, 0.5);
  margin-bottom: 32px;
}

.album-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  grid-template-columns: repeat(3, 1fr);
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
  flex: 1;
  max-height: 190px;
  overflow-y: auto;
  padding: 10px 12px 12px;
  display: grid;
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
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
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