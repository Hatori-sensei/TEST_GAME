<template>
  <div class="game">
    <ProgressBar
      v-if="currentSong && currentSong.length"
      :progress="progress"
    ></ProgressBar>

    <Countdown
      style="z-index: 1000; pointer-events: none"
      ref="countdown"
      @finish="instance.resumeGame()"
    ></Countdown>

    <transition name="modal-fade">
      <a
        class="pause_button"
        @click="pauseGame"
        v-if="started && instance && !instance.paused && !isGameEnded"
      >
        <v-icon name="regular/pause-circle" scale="1.5" />
      </a>
      <Navbar
        v-else-if="!isGameEnded"
        style="z-index: 1000"
        :gameNav="true"
      ></Navbar>
    </transition>

    <MarkComboJudge
      style="z-index: 400; pointer-events: none"
      ref="judgeDisplay"
      v-show="!isGameEnded"
    ></MarkComboJudge>

    <ZoomText class="zoom" ref="zoom"></ZoomText>

    <transition name="modal-fade">
      <Tutorial
        v-if="tutorial"
        v-show="started && !instance.paused"
        class="zoom allow-events"
      ></Tutorial>
    </transition>

    <div class="gameWrapper" :class="{ 'no-events': hideGameForYtButton }">
      <canvas ref="effectCanvas" id="effectCanvas"></canvas>
      <canvas
        ref="mainCanvas"
        id="gameCanvas"
        :class="{ perspective }"
      ></canvas>

      <div class="gear-overlay">
        <div class="judgment-line"></div>
        <div class="gear-ring"></div>
        <div class="gear-plate"></div>
        <div class="neon-grain"></div>
      </div>
      
      <div class="arcade-buttons">
        <div class="arcade-btn d-key" :class="{ 'is-pressed': keyState.key1 }">
          <span class="btn-label">D</span>
        </div>
        <div class="arcade-btn f-key" :class="{ 'is-pressed': keyState.key2 }">
          <span class="btn-label">F</span>
        </div>
        <div class="arcade-btn j-key" :class="{ 'is-pressed': keyState.key3 }">
          <span class="btn-label">J</span>
        </div>
        <div class="arcade-btn k-key" :class="{ 'is-pressed': keyState.key4 }">
          <span class="btn-label">K</span>
        </div>
      </div>
    </div>

    <Visualizer
      ref="visualizer"
      :setBlur="blur"
      v-show="!hideGameForYtButton"
    ></Visualizer>

    <ScorePanel></ScorePanel>

    <div></div>
    <div v-if="srcMode === 'youtube' && !isGameEnded" v-show="initialized">
      <Youtube
        :class="{ 'allow-events': srcMode === 'youtube' }"
        class="ytPlayerMobileExtend no-events"
        id="ytPlayer"
        ref="youtube"
        :video-id="youtubeId"
        :player-vars="$store.state.ytVars"
        :nocookie="$store.state.ytVars.nocookie"
        @playing="songLoaded"
        @cued="videoCued"
        @buffering="ytBuffering"
        @error="ytError"
        @paused="ytPaused"
        @ended="gameEnded"
      ></Youtube>
    </div>

    <transition name="modal-fade">
      <div
        class="modal-backdrop"
        :class="{ 'no-events': hideGameForYtButton }"
        v-if="showStartButton"
      >
        <div
          class="flex_hori start_page_button"
          @click="
            advancedMenuOptions = true;
            $refs.menu.show();
          "
          @mouseenter="handleHover"
        >
          <v-icon name="cog" scale="1.5" />
        </div>

        <div
          class="modal blurBackground"
          :class="{ darker: hideGameForYtButton }"
          ref="playButton"
          @mouseenter="handleHover"
        >
          <div
            class="modal-body"
            @click="hideGameForYtButton ? () => {} : startGame()"
          >
            <div class="flex_hori">
              <v-icon name="play" scale="1.5" />
              <div class="start_button_text">Start</div>
            </div>
          </div>
        </div>
        <div @click="showInfoMenu" @mouseenter="handleHover">
          <div class="flex_hori start_page_button">
            <v-icon name="info-circle" scale="1.5" />
          </div>
        </div>

        <div class="youtube_notice" v-if="srcMode === 'youtube'">
          Powered by YouTube.
          <br />
          Video copyright goes to the owner.
        </div>
      </div>
    </transition>

    <Loading
      style="z-index: 200"
      :show="instance && instance.loading && !youtubeBuffering"
      >Song Loading...</Loading
    >
    <Loading
      style="z-index: 200"
      :show="youtubeBuffering"
      :delay="true"
      :delayLength="3000"
      >Buffering...</Loading
    >
    <Loading style="z-index: 600" :show="isGameEnded && !showingAchievement"
      >Syncing Results...</Loading
    >

    <Modal
      ref="menu"
      :hideFooter="true"
      style="text-align: center; z-index: 500"
    >
      <template v-slot:header>
        <div style="width: 100%; font-size: 23px">
          {{ advancedMenuOptions ? "Options" : "Pause Menu" }}
        </div>
      </template>

      <template>
        <transition name="slide-fade" mode="out-in">
          <div v-if="!advancedMenuOptions" class="menu" key="1">
            <div class="btn-action btn-dark" @click="resumeGame(true)">
              <v-icon name="play" />
              <span>Resume</span>
            </div>
            <div class="btn-action btn-dark" @click="restartGame">
              <v-icon name="redo" />
              <span>Restart</span>
            </div>
            <div
              class="btn-action btn-dark"
              @click="advancedMenuOptions = true"
            >
              <v-icon name="cog" />
              <span>Advanced</span>
            </div>
            <div class="btn-action btn-dark" @click="exitGame">
              <v-icon name="sign-out-alt" />
              <span>Exit Game</span>
            </div>
          </div>

          <div v-else key="2">
            <PlayControl :playData="$data"></PlayControl>
            <br />
            <hr style="opacity: 0.2" />
            <div
              class="btn-action btn-dark"
              style="display: inline-block"
              @click="advancedMenuOptions = false"
              v-if="started"
            >
              Back
            </div>
            <div
              class="btn-action btn-dark"
              style="display: inline-block"
              @click="started ? resumeGame(true) : hideMenu(true)"
            >
              Done
            </div>
          </div>
        </transition>
      </template>
    </Modal>

    <Modal
      ref="info"
      :showCancel="false"
      style="text-align: center; z-index: 500"
    >
      <template v-slot:header>
        <div style="width: 100%; font-size: 23px">Sheet Info</div>
      </template>

      <template>
        <SheetDetailLine :sheet="currentSong"></SheetDetailLine>
      </template>
    </Modal>
  </div>
</template>

<script>
import PlayControl from "../components/common/PlayControl.vue";
import Visualizer from "../components/common/Visualizer.vue";
import Loading from "../components/ui/Loading.vue";
import Modal from "../components/ui/Modal.vue";
import ZoomText from "../components/game/ZoomText.vue";
import Navbar from "../components/ui/Navbar.vue";
import SheetDetailLine from "../components/menus/SheetDetailLine.vue";
import ProgressBar from "../components/game/ProgressBar.vue";
import Countdown from "../components/game/Countdown.vue";
import MarkComboJudge from "../components/game/MarkComboJudge.vue";
import Tutorial from "../components/game/Tutorial.vue";
import ScorePanel from "../components/game/ScorePanel.vue";
import GameMixin from "../mixins/gameMixin";
import { Youtube } from "vue-youtube";
import {
  getGameSheet,
  uploadResult,
  createPlay,
  updatePlay,
} from "../javascript/db";
import { logEvent, logError } from "../helpers/analytics";
import VanillaTilt from "vanilla-tilt";
import "vue-awesome/icons/regular/pause-circle";
import "vue-awesome/icons/play";
import "vue-awesome/icons/cog";
import "vue-awesome/icons/info-circle";
const isDev = process.env.NODE_ENV === "development";

export default {
  name: "Game",
  components: {
    PlayControl,
    Visualizer,
    Youtube,
    Loading,
    Modal,
    ZoomText,
    Navbar,
    ProgressBar,
    Countdown,
    SheetDetailLine,
    MarkComboJudge,
    Tutorial,
    ScorePanel,
  },
  mixins: [GameMixin],
  data() {
    return {
      playId: null,
      showingAchievement: false,
      tutorial: false,
      youtubeBuffering: false,
      // 🚨 UI 애니메이션을 위한 버튼 눌림 상태 추가
      keyState: { key1: false, key2: false, key3: false, key4: false }
    };
  },
  computed: {
    progress() {
      const startAt = this.currentSong.startAt ?? 0;
      let time = (this.instance.playTime - startAt) / this.currentSong.length;
      return time > 0 ? time : 0;
    },
  },
  mounted() {
    if (this.$route.params.sheet) {
      this.instance.loading = true;
      this.playWithId(this.$route.params.sheet);
    } else if (this.$route.path.includes("tutorial")) {
      // tutorial mode
      this.tutorial = true;
      this.playWithId("SItZEA9Uysy6RC1Ylkqh");
    } else {
      this.$store.state.gModal.show({
        bodyText: "No song is chosen, tap 'OK' to go to song list.",
        isError: true,
        showCancel: false,
        okCallback: this.exitGame,
      });
    }
    
    window.addEventListener("keydown", this.handleUIKeyDown);
    window.addEventListener("keyup", this.handleUIKeyUp);
  },
  beforeDestroy() {
    if (this.isGameEnded) return;
    this.reportExit("closed");

    window.removeEventListener("keydown", this.handleUIKeyDown);
    window.removeEventListener("keyup", this.handleUIKeyUp);
  },
  methods: {
    async playWithId(sheetId) {
      try {
        let song = await getGameSheet(sheetId);
        this.instance.loadSong(song);
        document.title = song.title + " - Rhythm+ Music Game";
      } catch (err) {
        this.$store.state.gModal.show({
          bodyText: "Sorry, this song does not exist or is unavaliable.",
          isError: true,
          showCancel: false,
          okCallback: this.exitGame,
        });
        logError("song_load_error_" + sheetId);
      }
    },
    handleHover() {
      this.$store.state.audio.playHoverEffect("ui/ta");
    },
    songLoaded() {
      Logger.log("playing");
      this.instance.loading = false;
      this.youtubeBuffering = false;
      if (!this.started) {
        // first loaded
        this.showStartButton = true;
        if (this.srcMode !== "youtube") return;
        this.ytPlayer?.setVolume(0);
        this.instance?.startSong();
        this.showStartButton = false;
        this.$refs.zoom.show("Get Ready...");
      } else {
        this.resumeGame();
      }
    },
    videoCued() {
      if (this.srcMode !== "youtube") return;
      Logger.log("cued");
      this.instance.loading = false;
      this.showStartButton = true;
      logEvent("youtube_cued");
    },
    ytBuffering() {
      Logger.log("buffering");
      if (this.showStartButton) {
        this.startGame();
      }
    },
    async startGame() {
      if (!this.showStartButton) return;
      logEvent("start_game", { songId: this.currentSong.songId });
      this.showStartButton = false;
      if (this.srcMode === "youtube") {
        this.instance.loading = true;
        this.youtubeBuffering = true;
        this.ytPlayer?.playVideo();
        this.ytPlayer?.setVolume(0);
      } else {
        if (!this.tutorial) this.$refs.zoom.show("Get Ready...");
        this.instance.startSong();
      }
      if (isDev) return;
      this.playId = await createPlay(
        this.currentSong.sheetId,
        this.currentSong.songId
      );
    },
    pauseGame() {
      if (!this.started || this.isGameEnded) return;
      this.instance.pauseGame();
      this.$refs.menu.show();
    },
    hideMenu(safeClose) {
      this.advancedMenuOptions = false;
      if (safeClose) this.$refs.menu.ok();
      else this.$refs.menu.close();
    },
    showInfoMenu() {
      this.$refs.info.show();
    },
    resumeGame(fromMenu) {
      this.hideMenu(true);
      if (!fromMenu) {
        this.$refs.countdown.clear();
        this.instance.resumeGame();
      } else {
        this.$refs.countdown.start();
      }
    },
    restartGame() {
      this.hideMenu();
      this.clearResult();
      this.instance.paused = false;
      this.instance.resetPlaying();
      this.instance.startSong();
    },
    exitGame(e, reason) {
      this.reportExit(reason ?? "exited");
      this.playId = null;
      this.hideMenu();
      this.$router.push("/menu");
    },
    updatePlay(data) {
      if (!this.playId) return;
      return updatePlay(this.playId, data);
    },
    reportExit(status) {
      const data = {
        status,
        playTime: this.instance.playTime,
        result: this.result,
      };
      this.updatePlay(data);
      logEvent("game_exited", data);
    },
    async gameEnded(isGameOver) {
      this.instance.destroyInstance();
      this.isGameEnded = true;
      let achievementPromise = Promise.resolve();
      if (isGameOver === true) {
        this.$router.push("/game-over/" + this.currentSong.sheetId);
        this.reportExit("failed");
        logEvent("game_failed");
        return;
      }
      if (this.tutorial) {
        this.exitGame(null, "tutorial-ends");
        return;
      }
      if (this.result.marks.miss == 0) {
        this.showingAchievement = true;
        this.$refs.zoom.show("Full Combo");
        this.$confetti.start();
        this.$store.state.audio.playEffect("wow");
        achievementPromise = new Promise((resolve) => {
          setTimeout(() => {
            this.showingAchievement = false;
            resolve();
          }, 2000);
        });
      }
      try {
        const uploadPromise = uploadResult({
          result: this.result,
          songId: this.currentSong.songId,
          sheetId: this.currentSong.sheetId,
          playId: this.playId,
          isAuthed: this.$store.state.authed,
        });
        const result = await Promise.all([uploadPromise, achievementPromise]);
        const res = result[0];
        Logger.log(res);
        this.$router.push("/result/" + res.data.resultId);
        this.$confetti.stop();
        this.updatePlay({ status: "finished", resultId: res.data.resultId });
        logEvent("result_uploaded", {
          resultId: res.data.resultId,
        });
      } catch (error) {
        Logger.error(error);
        this.$store.state.gModal.show({
          bodyText:
            "We are sorry, due to a connection failure, we are unable to save the result. Would you like to try again?",
          isError: true,
          showCancel: true,
          okCallback: this.gameEnded,
          cancelCallback: this.exitGame,
        });
        logError("result_upload_error");
      }
    },
    addTilt() {
      if (this.$refs.playButton) {
        VanillaTilt.init(this.$refs.playButton, { max: 8, glare: true, "max-glare": 0.5, scale: 1.1, });
      }
    },
    // 🚨 4버튼 UI 전용 키보드 이벤트 핸들러
    handleUIKeyDown(e) {
      const key = e.key.toLowerCase();
      if (key === 'd') this.keyState.key1 = true;
      if (key === 'f') this.keyState.key2 = true;
      if (key === 'j') this.keyState.key3 = true;
      if (key === 'k') this.keyState.key4 = true;
    },
    handleUIKeyUp(e) {
      const key = e.key.toLowerCase();
      if (key === 'd') this.keyState.key1 = false;
      if (key === 'f') this.keyState.key2 = false;
      if (key === 'j') this.keyState.key3 = false;
      if (key === 'k') this.keyState.key4 = false;
    }
  },
  
};
</script>

<style scoped>
* {
  overflow: hidden;
}

.game {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
}

.perspective {
  transform: rotateX(30deg) scaleY(1.5);
  transform-origin: 50% 100%;
}

.start_button_text {
  font-size: 20px;
  margin-left: 20px;
}

.start_page_button {
  padding: 30px;
  opacity: 0.5;
  cursor: pointer;
  transition: 0.5s;
  pointer-events: all;
  display: inline-block;
}

.start_page_button:hover {
  opacity: 0.8;
  transform: scale(1.2);
}

.menu .btn-action {
  position: relative;
}

.menu span {
  padding-left: 20px;
}

.menu .fa-icon {
  position: absolute;
  left: 20px;
  top: 12px;
}

.zoom {
  z-index: 1000;
  pointer-events: none;
}

@media only screen and (min-width: 800px) {
  /* desktop */
  .perspective {
    transform: rotateX(30deg) scale(1.5) scaleX(0.72);
  }

  .youtube_notice br {
    display: none;
  }
}

.pause_button {
  cursor: pointer;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0.5;
  z-index: 100;
  padding: 20px 30px 30px 20px;
}

.modal-body {
  display: flex;
  align-items: center;
  padding: 30px;
}

.modal {
  transition: 0;
  animation: none;
  width: auto;
  cursor: pointer;
}

.modal-backdrop {
  display: flex;
  flex-direction: row;
}

.darker {
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
}

.youtube_notice {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.3;
  font-size: 0.8em;
  width: 90%;
  text-align: center;
}

.no-events {
  pointer-events: none;
}

.allow-events {
  pointer-events: all;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}
.slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter,
.slide-fade-leave-to {
  transform: scaleX(0.1);
  opacity: 0;
}

/* =======================================================
   🚨 이미지 기반 디맥 아케이드 UI 완벽 재현 CSS 🚨
   ======================================================= */

/* =======================================================
   🚨 화면 잘림 해결 및 판정선 위치 최적화 (최종본) 🚨
   ======================================================= */

/* =======================================================
   🚨 DJMAX Respect V 완벽 재현 UI (최종) 🚨
   ======================================================= */

/* =======================================================
   🚨 DJMAX Respect V 완벽 재현 UI (최종 수정본) 🚨
   ======================================================= */

/* =======================================================
   🚨 DJMAX Respect V 완벽 복제 UI (최종 수정본) 🚨
   ======================================================= */

/* 🚨 최종 수정: 판정선과 버튼 영역의 물리적 충돌 오차 0px 적용 */

/* =======================================================
   🚨 DJMAX 스타일 3단 구조 UI (최종) 🚨
   낙하 영역 끝(판정선) -> 검은 여백(버퍼) -> 버튼 영역
   ======================================================= */

/* =======================================================
   🚨 [완전 재설계] DJMAX 3단 구조 UI 🚨
   ======================================================= */

/* 1. 기어(트랙) 배경: 화면 전체를 덮는 테두리 */
/* 1. 기어(트랙) 배경: 너비를 엔진 트랙 넓이와 일치시킴 */
/* 1. 기어(트랙) 배경 */
/* 1. 기어(트랙) 투명 껍데기 */
/* 1. 기어(트랙) 배경 및 양옆 구분선 */
/* =======================================================
   🚨 하단 노트 비침 완벽 차단 + DJMAX 아케이드 UI 🚨
   ======================================================= */

.gear-overlay {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 100%;
  pointer-events: none;
  z-index: 10;

  background: radial-gradient(circle at 50% 10%, rgba(0, 240, 255, 0.08), transparent 28%),
    radial-gradient(circle at 50% 90%, rgba(255, 255, 255, 0.05), transparent 18%),
    linear-gradient(180deg,
      rgba(0, 10, 24, 0.88) 0%,
      rgba(0, 10, 24, 0.42) 45%,
      rgba(0, 10, 24, 0.08) 100%);

  border-left: 2px solid rgba(0, 240, 255, 0.14);
  border-right: 2px solid rgba(0, 240, 255, 0.14);

  box-shadow: 0 0 22px rgba(0, 240, 255, 0.08), inset 0 0 40px rgba(0, 240, 255, 0.04);
  mix-blend-mode: screen;
  backdrop-filter: blur(1.8px);
  overflow: visible;
}

.gear-overlay::before,
.gear-overlay::after {
  content: "";
  position: absolute;
  left: 6px;
  right: 6px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0,240,255,0.75), transparent);
  filter: blur(6px);
  pointer-events: none;
  opacity: 0.9;
  animation: neonPulse 3.5s ease-in-out infinite;
}

.gear-overlay::before { top: 10px; }
.gear-overlay::after { bottom: 10px; }

.gear-overlay .gear-ring {
  position: absolute;
  inset: 10% 12%;
  border-radius: 50%;
  border: 1.5px solid rgba(0, 240, 255, 0.16);
  box-shadow: inset 0 0 22px rgba(0, 240, 255, 0.1);
  background: radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.08), transparent 55%);
}

.gear-overlay .gear-plate {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 70%;
  height: 14px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.12) 2px,
    transparent 2px,
    transparent 6px
  );
  opacity: 0.78;
}

.gear-overlay .neon-grain {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.006),
    rgba(255,255,255,0.006) 1px,
    transparent 1px,
    transparent 6px
  );
  mix-blend-mode: overlay;
  pointer-events: none;
  opacity: 0.6;
}

@keyframes neonPulse {
  0% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.01); opacity: 1; }
  100% { transform: scale(1); opacity: 0.85; }
}

@media (prefers-reduced-motion: reduce) {
  .gear-overlay::before,
  .gear-overlay::after {
    animation: none;
    filter: blur(4px);
  }
}

/* 2. 하단 버튼 영역: 바닥(0)에 붙이고 높이를 키워 가림막 역할 수행 */
.arcade-buttons {
  position: absolute;
  bottom: 0; /* 🚨 바닥에 완전히 붙여서 밑으로 노트가 새어나가는 걸 물리적으로 차단합니다 */
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 260px; /* 🚨 버튼 높이(100px) + 밑에 띄울 공백(140px) = 총 240px */
  background: radial-gradient(circle at 50% 15%, rgba(0, 255, 255, 0.08), transparent 30%),
    linear-gradient(180deg, #111111 0%, #070707 100%);
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: flex-start; /* 🚨 버튼들을 상단에 정렬시켜서 밑에 정확히 140px 공백을 남깁니다 */
  gap: 1px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 -2px 12px rgba(0,0,0,0.45);
  z-index: 20;
}

/* 3. 판정선 (관문) 위치: 바닥에서 320px */
.judgment-line {
  position: absolute;
  bottom: 320px; 
  left: -2px; 
  width: calc(100% + 4px); 
  height: 18px; 
  background-color: #ffffff; 
  z-index: 50; 
  box-shadow: 0px 0px 10px #00f0ff, 0px 0px 20px #00f0ff;
}

/* =======================================================
   버튼 디자인 및 키 입력 발광 효과 (높이 100px 고정)
   ======================================================= */
.arcade-btn {
  flex: 1;
  height: 100px; /* 🚨 부모 박스가 240px로 커졌으므로, 버튼 순수 높이는 100px로 고정합니다 */
  background: linear-gradient(180deg, #161616 0%, #090909 55%, #050505 100%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-top: 2px solid rgba(255, 255, 255, 0.12);
  position: relative;
  overflow: hidden;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.05), inset 0 -6px 16px rgba(0,0,0,0.25);
}

.arcade-btn::before {
  content: "";
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  height: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.12), transparent 90%);
  pointer-events: none;
}

.arcade-btn::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 10px;
  width: 55%;
  height: 4px;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  pointer-events: none;
}

.arcade-btn.is-pressed {
  border-top: 2px solid transparent;
  transform: translateY(4px);
  background: linear-gradient(180deg, #101010 0%, #060606 50%, #020202 100%);
  box-shadow: inset 0 2px 4px rgba(255,255,255,0.04), inset 0 -8px 18px rgba(0,0,0,0.35);
}

/* D, K 키 (시안색 발광) */
.arcade-btn.d-key.is-pressed, .arcade-btn.k-key.is-pressed {
  background: linear-gradient(180deg, rgba(0, 240, 255, 0.2) 0%, #050505 100%);
  box-shadow: 0px -20px 50px rgba(0, 240, 255, 0.3), inset 0px 0px 20px rgba(0, 240, 255, 0.8);
}

/* F, J 키 (마젠타색 발광) */
.arcade-btn.f-key.is-pressed, .arcade-btn.j-key.is-pressed {
  background: linear-gradient(180deg, rgba(255, 0, 160, 0.2) 0%, #050505 100%);
  box-shadow: 0px -20px 50px rgba(255, 0, 160, 0.3), inset 0px 0px 20px rgba(255, 0, 160, 0.8);
}

.btn-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: Arial, sans-serif;
  font-weight: 900;
  font-size: 24px;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.16em;
  text-shadow: 0 0 4px rgba(255,255,255,0.14);
}

.arcade-btn:hover {
  transform: translateY(-1px);
}

.arcade-btn.d-key.is-pressed .btn-label, .arcade-btn.k-key.is-pressed .btn-label { color: #00f0ff; text-shadow: 0px 0px 14px #00f0ff; }
.arcade-btn.f-key.is-pressed .btn-label, .arcade-btn.j-key.is-pressed .btn-label { color: #ff00a0; text-shadow: 0px 0px 14px #ff00a0; }



</style>