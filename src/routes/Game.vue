<template>
  <div class="game" :class="{ 'tv-off-active': tvOff, 'song-fade-out': songFadeOut }">
    <div class="tv-off-screen" v-if="tvOff">
      <div class="tv-off-line top"></div>
      <div class="tv-off-line bottom"></div>
      <div class="tv-off-flash"></div>
    </div>
    <ProgressBar v-if="currentSong" :progress="progress"></ProgressBar>

    <Countdown
      style="z-index: 1000; pointer-events: none"
      ref="countdown"
      @finish="handleCountdownFinished"
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
      <video
        v-if="currentSong?.bgaPath"
        ref="bgaVideo"
        :src="resolveMediaUrl(currentSong.bgaPath)"
        class="bga-video"
        muted
        playsinline
        preload="auto"
        @error="(e) => { e.target.style.display = 'none'; }"
      ></video>
      <div v-if="currentSong?.bgaPath" class="bga-overlay"></div>
      <canvas ref="effectCanvas" id="effectCanvas"></canvas>
      <canvas
        ref="mainCanvas"
        id="gameCanvas"
        :class="{ perspective }"
      ></canvas>

      <div class="gear-overlay">
        <div class="gear-display">
          <div class="display-item stats-display">
            <span class="stat perfect">P: {{ result.marks.perfect }}</span>
            <span class="stat good">G: {{ result.marks.good }}</span>
            <span class="stat miss">M: {{ result.marks.miss }}</span>
          </div>
        </div>
        <div class="judgment-line"></div>
      </div>
      <div class="arcade-buttons">
        <div class="buttons-container">
          <div
            class="arcade-btn d-key"
            :class="{ 'is-pressed': keyState.key1 }"
          ></div>
          <div
            class="arcade-btn f-key"
            :class="{ 'is-pressed': keyState.key2 }"
          ></div>
          <div
            class="arcade-btn j-key"
            :class="{ 'is-pressed': keyState.key3 }"
          ></div>
          <div
            class="arcade-btn k-key"
            :class="{ 'is-pressed': keyState.key4 }"
          ></div>
        </div>
      </div>
    </div>

    <Visualizer
      ref="visualizer"
      :setBlur="blur"
      v-show="!hideGameForYtButton"
    ></Visualizer>

    <ScorePanel></ScorePanel>

    <HealthBar v-show="!isGameEnded" :health="health"></HealthBar>
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
import HealthBar from "../components/game/HealthBar.vue";
import GameMixin from "../mixins/gameMixin";
import { Youtube } from "vue-youtube";
import {
  getGameSheet,
  uploadResult,
  createPlay,
  updatePlay,
} from "../javascript/db";
import { logEvent, logError } from "../helpers/analytics";
import { resolveMediaUrl as resolveMediaPath } from "../utils/pathResolver";
import VanillaTilt from "vanilla-tilt";
import "vue-awesome/icons/regular/pause-circle";
import "vue-awesome/icons/play";
import "vue-awesome/icons/cog";
import "vue-awesome/icons/info-circle";
const isDev = process.env.NODE_ENV === "development";
const GAME_START_DELAY_MS = 4000;
const SONG_END_FADE_DELAY_MS = 2200;

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
    HealthBar,
  },
  mixins: [GameMixin],
  data() {
    return {
      playId: null,
      showingAchievement: false,
      tutorial: false,
      youtubeBuffering: false,
      // 🚨 UI 애니메이션을 위한 버튼 눌림 상태 추가
      keyState: { key1: false, key2: false, key3: false, key4: false },
      // TV off animation flag
      tvOff: false,
      songFadeOut: false,
      isEndingSong: false,
    };
  },
  computed: {
    progress() {
      if (!this.currentSong || !this.instance) return 0;
      const startAt = Number(this.currentSong.startAt ?? 0);
      const duration = Number(
        this.currentSong.runtimeLength ??
          this.instance.songDurationSeconds ??
          this.currentSong.length
      );
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
      const elapsed = Math.max(0, Number(this.instance.currentTime || 0) - startAt);
      return Math.min(1, elapsed / safeDuration);
    },
  },
  watch: {
    currentSong() {
      this.$nextTick(() => {
        if (
          this.instance &&
          typeof this.instance.setVideoElement === "function"
        ) {
          this.instance.setVideoElement(this.$refs.bgaVideo || null);
        }
      });
    },
  },
  mounted() {
    this.$nextTick(() => {
      if (this.state) {
        this.state.loading = false;
      } else if (this.gameState) {
        this.gameState.loading = false;
      } else if (Object.prototype.hasOwnProperty.call(this.$data, "loading")) {
        this.loading = false;
      }
    });

    if (this.instance) {
      this.instance.onTick = (timeData) => {
        if (
          this.$refs.trackComponent &&
          typeof this.$refs.trackComponent.update === "function"
        ) {
          this.$refs.trackComponent.update(timeData.audioTime);
        }

        const bgaVideo = this.$refs.bgaVideo;
        if (
          bgaVideo &&
          !timeData.paused &&
          bgaVideo.paused &&
          timeData.audioTime > 0
        ) {
          bgaVideo.play().catch((e) => console.warn(e));
        }
      };
    }

    if (this.$route.params.sheet) {
      if (this.instance) {
        this.instance.loading = true;
      }
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
    resolveMediaUrl(path) {
      return resolveMediaPath(path);
    },
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
    handleCountdownFinished() {
      if (this.instance) {
        this.instance.resumeGame(false);
      }
    },
    async handleSongFinished() {
      if (this.isGameEnded || this.isEndingSong) return;
      this.isEndingSong = true;
      this.songFadeOut = true;
      this.instance?.pauseVideo?.();
      await new Promise((resolve) => setTimeout(resolve, SONG_END_FADE_DELAY_MS));
      this.gameEnded(false);
    },
    songLoaded() {
      Logger.log("playing");
      this.instance.loading = false;
      this.youtubeBuffering = false;
      if (!this.started) {
        // 배속 설정 적용 (선곡 화면에서 설정된 값)
        if (this.$store.state.userProfile?.noteSpeed) {
          // apply only as initial preference before game start
          if (!this.started) {
            this.noteSpeed = this.$store.state.userProfile.noteSpeed;
            this.instance.reposition();
          }
        }
        // first loaded
        if (this.srcMode !== "youtube") {
          // 비YouTube 모드: 바로 시작
          this.showStartButton = false;
          this.startGameDirect();
          return;
        }
        // YouTube 모드
        this.showStartButton = true;
        this.ytPlayer?.setVolume(0);
        this.instance?.startSong();
        this.showStartButton = false;
        this.$refs.zoom.show("Get Ready...");
      } else {
        this.resumeGame();
      }
    },
    onAudioLoaded(audioPath) {
      Logger.log("audio loaded", audioPath);
      this.instance.loading = false;
      this.youtubeBuffering = false;
      if (!this.started && this.srcMode !== "youtube") {
        this.showStartButton = false;
        this.startGameDirect();
      }
    },
    handleAudioLoadError(error, audioPath) {
      Logger.error("audio load error", audioPath, error);
      this.instance.loading = false;
      this.youtubeBuffering = false;
      this.$store.state.gModal.show({
        bodyText:
          "Unable to load the song audio or the song data is missing. Returning to song select.",
        isError: true,
        showCancel: false,
        okCallback: () => this.exitGame(null, "audio-load-failed"),
      });
    },
    videoCued() {
      if (this.srcMode !== "youtube") return;
      Logger.log("cued");
      this.instance.loading = false;
      this.showStartButton = true;
      logEvent("youtube_cued");
      // 자동으로 게임 시작
      setTimeout(() => {
        if (this.showStartButton) {
          this.startGame();
        }
      }, 500);
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
      // 체력 초기화
      this.health = 100;
      if (this.srcMode === "youtube") {
        this.instance.loading = true;
        this.youtubeBuffering = true;
        this.ytPlayer?.playVideo();
        this.ytPlayer?.setVolume(0);
        this.$refs.zoom.show("Get Ready...");
        // 스타트 후 4초 쿨타임 뒤에 음악/BGA 시작
        await new Promise((resolve) => setTimeout(resolve, GAME_START_DELAY_MS));
        this.instance.startSong();
      } else {
        if (!this.tutorial) this.$refs.zoom.show("Get Ready...");
        // 스타트 후 4초 쿨타임 뒤에 음악/BGA 시작
        await new Promise((resolve) => setTimeout(resolve, GAME_START_DELAY_MS));
        this.instance.startSong();
      }
      if (isDev) return;
      this.playId = await createPlay(
        this.currentSong.sheetId,
        this.currentSong.songId
      );
    },
    async startGameDirect() {
      logEvent("start_game", { songId: this.currentSong.songId });
      this.health = 100;
      this.$refs.zoom.show("Get Ready...");
      // 스타트 후 4초 쿨타임 뒤에 음악/BGA 시작
      await new Promise((resolve) => setTimeout(resolve, GAME_START_DELAY_MS));
      this.instance.startSong();
      if (isDev) return;
      this.playId = await createPlay(
        this.currentSong.sheetId,
        this.currentSong.songId
      );
    },
    triggerGameOverImmediate() {
      if (this.tvOff) return;
      this.fadeOutMusic();
      this.tvOff = true;
      setTimeout(() => {
        try {
          this.gameEnded(true);
        } catch (e) {
          this.isGameEnded = true;
          if (this.instance && typeof this.instance.pauseGame === "function") {
            this.instance.pauseGame();
          }
        }
      }, 300);
    },
    fadeOutMusic() {
      if (this.srcMode === "youtube") {
        this.fadeOutYoutube(300);
      }
      if (
        this.$store.state.audio &&
        typeof this.$store.state.audio.fadeOut === "function"
      ) {
        this.$store.state.audio.fadeOut(300);
      }
    },
    fadeOutYoutube(duration = 300) {
      if (
        !this.ytPlayer ||
        typeof this.ytPlayer.getVolume !== "function" ||
        typeof this.ytPlayer.setVolume !== "function"
      ) {
        return;
      }
      const stepTime = 50;
      const steps = Math.max(1, Math.ceil(duration / stepTime));
      let currentVolume = this.ytPlayer.getVolume();
      const delta = currentVolume / steps;
      const fadeInterval = setInterval(() => {
        currentVolume -= delta;
        if (currentVolume <= 0) {
          this.ytPlayer.setVolume(0);
          clearInterval(fadeInterval);
          return;
        }
        this.ytPlayer.setVolume(Math.max(0, Math.round(currentVolume)));
      }, stepTime);
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
        this.$refs.countdown.clear(false);
        this.instance.resumeGame(false);
      } else {
        this.$refs.countdown.start();
      }
    },
    restartGame() {
      this.hideMenu();
      this.clearResult();
      this.health = 100; // 체력 초기화
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
      this.isEndingSong = false;
      if (typeof this.finalizeResultMetrics === "function") {
        this.finalizeResultMetrics();
      }
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
        VanillaTilt.init(this.$refs.playButton, {
          max: 8,
          glare: true,
          "max-glare": 0.5,
          scale: 1.1,
        });
      }
    },
    // 🚨 4버튼 UI 전용 키보드 이벤트 핸들러
    handleUIKeyDown(e) {
      const key = e.key.toLowerCase();
      if (key === "d") this.keyState.key1 = true;
      if (key === "f") this.keyState.key2 = true;
      if (key === "j") this.keyState.key3 = true;
      if (key === "k") this.keyState.key4 = true;
    },
    handleUIKeyUp(e) {
      const key = e.key.toLowerCase();
      if (key === "d") this.keyState.key1 = false;
      if (key === "f") this.keyState.key2 = false;
      if (key === "j") this.keyState.key3 = false;
      if (key === "k") this.keyState.key4 = false;
    },
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
  opacity: 1;
  transition: opacity 1.2s ease;
}

.game.song-fade-out {
  opacity: 0;
}

.gameWrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

.bga-video,
.bga-overlay,
#effectCanvas,
#gameCanvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.bga-video {
  object-fit: contain;
  object-position: center center;
  z-index: 0;
  pointer-events: none;
}

.bga-overlay {
  background: rgba(0, 0, 0, 0.35);
  z-index: 1;
  pointer-events: none;
}

#effectCanvas {
  z-index: 2;
}

#gameCanvas {
  z-index: 3;
}

.gear-overlay {
  position: absolute;
  z-index: 4;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.perspective {
  transform: rotateX(30deg) scaleY(1.5);
  transform-origin: 50% 100%;
}

/* TV off overlay animation */
/* =======================================================
   🚨 리얼 브라운관 TV 꺼짐 (플레이 화면 초고속 0.35초 압축)
   ======================================================= */
/* 불필요한 기존 오버레이 요소들 숨김 */
.tv-off-screen {
  display: none;
}

/* 게임 화면 전체가 중심을 기준으로 0.35초 만에 확 찌그러짐 */
.game.tv-off-active {
  transform-origin: center center;
  animation: crt_off_game 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards !important;
  pointer-events: none;
  background: black;
}

/* 진짜 티비 꺼지듯 슉! -> 점 -> 쾅! 소멸하는 애니메이션 */
@keyframes crt_off_game {
  0% {
    transform: scale(1, 1);
    filter: brightness(1) contrast(1);
  }
  40% {
    /* 순식간에 높이를 쳐내서 극단적으로 얇고 눈부신 가로선으로 압축 */
    transform: scale(1, 0.005);
    filter: brightness(5) contrast(3);
  }
  70% {
    /* 가로선이 중앙의 점으로 빨려 들어감 */
    transform: scale(0, 0.005);
    filter: brightness(5);
  }
  100% {
    /* 완전 소멸 */
    transform: scale(0, 0);
    filter: brightness(0);
  }
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

/* 1. 기어(트랙) 배경 및 양옆 구분선 */
/* =======================================================
   1. 기어(트랙) 배경
   ======================================================= */
.gear-overlay {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 100%;
  background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 20px,
      rgba(0, 240, 255, 0.03) 20px,
      rgba(0, 240, 255, 0.03) 21px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 40px,
      rgba(0, 240, 255, 0.02) 40px,
      rgba(0, 240, 255, 0.02) 41px
    );
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  border-right: 2px solid rgba(255, 255, 255, 0.15);
  pointer-events: none;
  z-index: 10;
}

/* 기어 상단 미니 디스플레이 */
.gear-display {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    180deg,
    rgba(0, 240, 255, 0.1) 0%,
    transparent 100%
  );
  border-bottom: 1px solid rgba(0, 240, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 20px;
  box-sizing: border-box;
  z-index: 15;
  pointer-events: none;
}

.display-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
}

.display-item .label {
  color: rgba(0, 240, 255, 0.6);
  font-weight: bold;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.display-item .value {
  color: #00ffff;
  font-weight: 900;
  font-size: 1rem;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
  font-family: "Anton", monospace;
}

.stats-display {
  display: flex;
  gap: 12px;
}

.stat {
  font-weight: bold;
  font-size: 0.8rem;
  text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.stat.perfect {
  color: #15ff00;
}

.stat.good {
  color: #00ffea;
}

.stat.miss {
  color: #ff3232;
}

/* =======================================================
   2. 하단 버튼 컨테이너 (기어와 버튼의 분리)
   ======================================================= */
.arcade-buttons {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 260px; /* 기존 높이 유지 */
  background-color: #161616; /* 버튼 밑 공간을 채우는 베젤 */
  display: flex;
  flex-direction: column;
  z-index: 20;
}

/* 버튼들을 감싸는 영역 */
.buttons-container {
  display: flex;
  height: 100px; /* 버튼 높이만 차지 */
  width: 100%;
  gap: 1px;
}

/* =======================================================
   3. 판정선 
   ======================================================= */
.judgment-line {
  position: absolute;
  bottom: 320px;
  left: 0;
  width: 100%;
  height: 18px;
  background-color: #ffffff;
  z-index: 50;
  box-shadow: 0px 0px 15px #ffffff, 0px 0px 30px #00f0ff;
}

/* =======================================================
   4. 버튼 디자인 및 타격감
   ======================================================= */
.arcade-btn {
  flex: 1;
  height: 100%;
  background: linear-gradient(180deg, #222 0%, #000 100%);
  border-top: 3px solid #444; /* 기어와 확실히 구분되는 경계선 */
  position: relative;
  transition: all 0.05s ease;
}

/* 물리적으로 눌리는 느낌 (4px 하강) */
.arcade-btn.is-pressed {
  transform: translateY(4px);
  border-top: none;
}

/* D, K 키 (시안색 계열) */
.arcade-btn.d-key.is-pressed,
.arcade-btn.k-key.is-pressed {
  background: linear-gradient(180deg, rgba(0, 240, 255, 0.4) 0%, #000 100%);
  box-shadow: inset 0px 0px 20px rgba(0, 240, 255, 0.6);
}

/* F, J 키 (마젠타색 계열) */
.arcade-btn.f-key.is-pressed,
.arcade-btn.j-key.is-pressed {
  background: linear-gradient(180deg, rgba(255, 0, 160, 0.4) 0%, #000 100%);
  box-shadow: inset 0px 0px 20px rgba(255, 0, 160, 0.6);
}
</style>
