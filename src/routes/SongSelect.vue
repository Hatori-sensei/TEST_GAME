<template>
  <div class="song-select-page">
    <!-- 배경: 현재 선택된 곡의 이미지를 흐리게 깔아주는 감성 효과 -->
    <div class="bg-blur" :style="{ backgroundImage: bgImage }"></div>

    <div class="layout-container">
      <!-- 왼쪽 패널: 앨범 아트, 제목, 난이도 (상세 정보) -->
      <div class="left-panel">
        <transition name="fade" mode="out-in">
          <div class="song-info" v-if="selectedSong" :key="selectedSong.id">
            <!-- 앨범 아트 (유튜브 썸네일 or 커스텀 이미지) -->
            <div class="album-art-wrapper">
              <img :src="coverImage" class="album-art" />
            </div>
            
            <h1 class="song-title">{{ selectedSong.title }}</h1>
            <p class="song-artist">{{ selectedSong.artist || 'Unknown Artist' }}</p>

            <!-- 난이도(Sheet) 목록: 클릭하면 바로 게임 시작 -->
            <div class="sheet-list" v-if="sheetList && sheetList.length > 0">
              <div 
                v-for="(sheet, idx) in sheetList" 
                :key="sheet.id" 
                class="sheet-btn" 
                @click="playGame(sheet.id)"
              >
                <span class="keys">{{ sheet.keys }}K</span>
                <span class="diff">Lv.{{ sheet.difficulty }}</span>
                <span class="play-text">PLAY</span>
              </div>
            </div>
            <Loading v-else :show="true" text="Loading Sheets..." />
          </div>
          <div v-else class="empty-state">
            Loading Songs...
          </div>
        </transition>
      </div>

      <!-- 오른쪽 패널: 세로 슬라이드 곡 목록 -->
      <div class="right-panel">
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
            </div>
          </div>
          <Loading :show="!songList || songList.length === 0" text="Fetching Songs..." />
        </div>
        
        <!-- 하단 유틸 버튼들 -->
        <div class="util-buttons">
          <div class="util-btn" @click="$router.push('/tutorial/')">Tutorial</div>
          <div class="util-btn" @click="$router.push('/studio/')">Create Song</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Loading from "../components/ui/Loading.vue";
import { getSheetList, getSongListCached, getPlaylist, getSongsInIdArray } from "../javascript/db";
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
      selectedIndex: 0, // 키보드 조작을 위한 인덱스
      tab: "recom",
    };
  },
  computed: {
    // 🚨 여기서 썸네일 이미지를 결정합니다. 나중에 DB에 customCoverUrl을 넣으면 그걸 최우선으로 띄웁니다!
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
        this.sheetList = await getSheetList(this.selectedSong.id); // 기존 DB 연동 로직 유지[cite: 12]
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
      this.selectSong(0); // 탭을 바꾸면 첫 번째 곡으로 초기화
    },
  },
  mounted() {
    this.filterRecommended(true);
    // 🚨 키보드 조작 이벤트 리스너 추가
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
      this.selectedSong = this.songList[this.selectedIndex];
      this.scrollToSelected();
    },
    
    // 🚨 키보드 조작 로직 (위/아래 방향키 및 엔터)
    handleKeydown(e) {
      if (!this.songList || this.songList.length === 0) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let newIdx = this.selectedIndex + 1;
        if (newIdx >= this.songList.length) newIdx = 0;
        this.selectSong(newIdx);
        this.$store.state.audio.playHoverEffect("ui/ta");
      } 
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        let newIdx = this.selectedIndex - 1;
        if (newIdx < 0) newIdx = this.songList.length - 1;
        this.selectSong(newIdx);
        this.$store.state.audio.playHoverEffect("ui/ta");
      }
      else if (e.key === 'Enter') {
        e.preventDefault();
        // 엔터를 누르면 첫 번째 난이도로 바로 시작!
        if (this.sheetList && this.sheetList.length > 0) {
          this.playGame(this.sheetList[0].id);
        }
      }
    },
    
    // 선택된 곡이 화면 중앙에 오도록 스크롤 이동
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
      this.$store.state.audio.playEffect("ui/slide2");
      this.$router.push("/game/" + sheetId); // 게임 화면으로 이동
    },

    // --- 기존 DB 데이터 불러오기 로직 그대로 유지 ---[cite: 12]
    async getAllSongs() {
      if (!this.allSongs) this.allSongs = await getSongListCached();
    },
    async filterRecommended(getRecommened) {
      await this.getAllSongs();
      const playlist = await getPlaylist("recommended");
      if (getRecommened) {
        this.songList = this.allSongs.filter(e => playlist.items.includes(e.id));
      } else {
        this.songList = this.allSongs.filter(e => !playlist.items.includes(e.id));
      }
      this.selectSong(0);
    },
    async getNewSongs() {
      await this.getAllSongs();
      this.songList = [...this.allSongs].sort((a, b) => b.dateUpdated.seconds - a.dateUpdated.seconds).slice(0, 35);
      this.selectSong(0);
    }
  },
};
</script>

<style scoped>
/* 🚨 DJMAX 스타일 클린 & 미니멀리즘 CSS */
.song-select-page {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: #050505;
  color: white;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.bg-blur {
  position: absolute;
  top: -5%; left: -5%;
  width: 110%; height: 110%;
  background-size: cover;
  background-position: center;
  filter: blur(40px) brightness(0.2);
  z-index: 0;
  transition: background-image 0.5s ease-in-out;
}

.layout-container {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%; height: 100%;
}

/* === 왼쪽 패널 (상세 정보) === */
.left-panel {
  flex: 1; /* 화면의 절반을 차지하도록 설정 */
  width: 50%; 
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px;
  box-sizing: border-box;
}

.song-info {
  text-align: center;
  width: 100%;
  max-width: 600px;
}

.album-art-wrapper {
  width: 100%;
  max-width: 500px;
  aspect-ratio: 16/9;
  margin: 0 auto 30px auto;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8);
}

.album-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.song-artist {
  font-size: 1.2rem;
  color: #aaa;
  margin-bottom: 40px;
}

.sheet-list {
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
}

.sheet-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px 25px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s;
}

.sheet-btn:hover {
  background: white;
  color: black;
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(255,255,255,0.2);
}

.sheet-btn .keys { font-weight: bold; font-size: 1.2rem; }
.sheet-btn .diff { font-size: 0.9rem; opacity: 0.8; margin: 5px 0; }
.sheet-btn .play-text { font-size: 0.8rem; letter-spacing: 2px; }

/* === 오른쪽 패널 (곡 목록) === */
.right-panel {
  flex: 1; /* 기존 width: 450px; 를 제거하고 화면의 절반 차지하게 변경 */
  width: 50%;
  background: rgba(0, 0, 0, 0.6);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab {
  flex: 1;
  text-align: center;
  padding: 20px 0;
  cursor: pointer;
  color: #888;
  font-weight: bold;
  transition: 0.3s;
}

.tab:hover { color: #ccc; }
.tab.active { color: white; border-bottom: 3px solid white; }

.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}

/* 스크롤바 숨기기 (깔끔함을 위해) */
.list-container::-webkit-scrollbar { display: none; }

.song-item {
  padding: 20px 30px;
  cursor: pointer;
  border-left: 4px solid transparent;
  transition: all 0.2s;
  color: #888;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ccc;
}

.song-item.active {
  background: rgba(255, 255, 255, 0.1);
  border-left: 4px solid white;
  color: white;
  transform: scale(1.02);
  transform-origin: left;
}

.song-name {
  font-size: 1.2rem;
  font-weight: 600;
}

.util-buttons {
  display: flex;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.util-btn {
  flex: 1;
  text-align: center;
  padding: 20px;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.5);
  transition: 0.2s;
}
.util-btn:hover { background: rgba(255, 255, 255, 0.1); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.fade-enter, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>