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
        v-if="started && instance && !instance.paused && !isGameEnded && !vs"
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
      <div
        v-if="currentSong?.bgaPath"
        class="bga-overlay"
        :style="{ background: `rgba(0, 0, 0, ${bgaDim})` }"
      ></div>
      <canvas ref="effectCanvas" id="effectCanvas"></canvas>
      <canvas
        ref="mainCanvas"
        id="gameCanvas"
        :class="{ perspective }"
      ></canvas>

      <div class="gear-overlay">
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

    <!-- [대기 화면] 데모 자동 연주 표시 -->
    <div class="demo-banner" v-if="isDemo">
      <div class="demo-title">SAMPLE PLAY</div>
      <div class="demo-sub">PRESS ANY KEY</div>
    </div>

    <!-- [LAN 대전] 대전 중일 때만: 상대 점수/순위 + 시작 카운트다운 -->
    <VsHud
      v-if="vs"
      :vs="vs"
      :result="result"
      :health="health"
      :percentage="percentage"
      :currentTime="progressTime"
      :startAt="vsStartAt"
    ></VsHud>

    <HealthBar v-show="!isGameEnded && !loadingScreen" :health="health"></HealthBar>
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

    <GameLoadingScreen :show="loadingScreen" :song="currentSong"></GameLoadingScreen>
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
import GameLoadingScreen from "../components/game/GameLoadingScreen.vue";
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
import VsHud from "../components/game/VsHud.vue";
import { vsLoaded, vsFinish, waitForStartAt } from "../helpers/vs";
import { setGameIdleCheck } from "../helpers/attract";
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
const LOADING_SCREEN_MIN_MS = 1800;
const SONG_END_FADE_DELAY_MS = 2200;
const VS_FALLBACK_START_MS = 25000; // [LAN 대전] 호스트 응답이 없으면 이 시간 뒤 혼자라도 시작

export default {
  name: "Game",
  components: {
    PlayControl,
    Visualizer,
    Youtube,
    Loading,
    GameLoadingScreen,
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
    VsHud,
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
      // full-screen loading screen, shown from the moment the game screen opens
      loadingScreen: true,
      // [버그수정] mixin 기본값 "youtube" 때문에 곡 정보를 읽기 전 잠깐 YouTube 플레이어가
      // 만들어져 매 판 youtube.com 접속을 시도했고, 실패 시 "problem with the source" 오류
      // 팝업이 가끔 떴음(오프라인 축제 PC). 곡은 전부 로컬이므로 기본값을 local로.
      srcMode: "local",
      loadingScreenSince: Date.now(),
      // [성능] 진행 바용 재생 시간(0.1초 단위로만 갱신). progress가 instance.currentTime을
      // 직접 읽으면 매 프레임 Game 화면 전체가 다시 렌더링됐음.
      progressTime: 0,
      vsStartAt: 0, // [LAN 대전] 호스트가 정한 시작 시각(호스트 시계 ms)
    };
  },
  computed: {
    // [LAN 대전] 대전 컨텍스트(평소엔 null → 아래 대전 분기는 전부 건너뜀)
    vs() {
      return this.$store.state.vs;
    },
    // [대기 화면] SAMPLE PLAY(타이틀 방치 시 자동 연주). 기록/결과 화면 없이 끝나면 타이틀로
    isDemo() {
      return this.$route.query.demo === "1";
    },
    progress() {
      if (!this.currentSong || !this.instance) return 0;
      const startAt = Number(this.currentSong.startAt ?? 0);
      const duration = Number(
        this.currentSong.runtimeLength ??
          this.instance.songDurationSeconds ??
          this.currentSong.length
      );
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
      const elapsed = Math.max(0, Number(this.progressTime || 0) - startAt);
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
        // [성능] 진행 바 시간은 0.1초 이상 바뀔 때만 반영(ProgressBar도 100ms마다 샘플링함)
        if (Math.abs(timeData.audioTime - this.progressTime) >= 0.1) {
          this.progressTime = timeData.audioTime;
        }

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

    // [대기 화면] 일시정지 메뉴를 띄운 채 방치되면 타이틀로 돌아가도록 상태 제공
    setGameIdleCheck(() => this.started && !this.isGameEnded && !this.vs && !this.isDemo && !!this.instance && this.instance.paused);
    if (this.isDemo) {
      // 데모: 오토플레이 + 게임오버 없음. 아무 키(또는 클릭)나 누르면 타이틀로
      this.autoPlay = true;
      this.noFail = true;
      window.addEventListener("keydown", this.onDemoKey, true);
      window.addEventListener("pointerdown", this.blockDemoPointer, true);
      window.addEventListener("click", this.onDemoKey, true);
    }
  },
  beforeDestroy() {
    // [버그수정] 리스너 해제를 early return 앞으로 이동. 예전엔 곡을 끝까지 플레이하거나
    // 게임오버로 나가면(isGameEnded) 해제되지 않아, 판마다 window 리스너와 함께
    // 파괴된 Game 화면 전체(BGA video, canvas 등)가 메모리에 계속 남았음(장시간 운영 시 누적).
    window.removeEventListener("keydown", this.handleUIKeyDown);
    window.removeEventListener("keyup", this.handleUIKeyUp);
    setGameIdleCheck(null);
    window.removeEventListener("keydown", this.onDemoKey, true);
    window.removeEventListener("pointerdown", this.blockDemoPointer, true);
    window.removeEventListener("click", this.onDemoKey, true);
    clearTimeout(this.demoTimer);

    if (this.isGameEnded) return;
    this.reportExit("closed");
  },
  methods: {
    resolveMediaUrl(path) {
      return resolveMediaPath(path);
    },
    async playWithId(sheetId) {
      try {
        let song = await getGameSheet(sheetId);
        if (this.isGone()) return;
        // [대기 화면] 재생 목록에서 시작 위치를 지정한 경우(?from=초)
        if (this.isDemo && Number(this.$route.query.from) > 0) song = { ...song, startAt: Number(this.$route.query.from) };
        const pendingOptions = this.$store.state.pendingGameOptions;
        const gameOptions = pendingOptions && typeof pendingOptions === "object"
          ? pendingOptions
          : {
              randomGimmickMode: this.$store.state.randomGimmickMode || "off",
            };
        this.instance.loadSong(song, gameOptions);
        this.$store.commit("setPendingGameOptions", null);
        document.title = song.title + " - Rhythm+ Music Game";
      } catch (err) {
        this.loadingScreen = false;
        this.$store.state.gModal.show({
          bodyText: "Sorry, this song does not exist or is unavaliable.",
          isError: true,
          showCancel: false,
          okCallback: this.exitGame,
        });
        logError("song_load_error_" + sheetId);
      }
    },
    // [버그수정] 로딩 중에 화면을 떠나면(데모 중 키 입력, 곡 선택으로 이동 등) 이 화면이 파괴된 뒤에도
    // 로딩/대기 콜백이 늦게 도착해 $refs.zoom(undefined).show 등에서 오류가 났음 → 파괴됐으면 무시
    isGone() {
      return this._isDestroyed || this._isBeingDestroyed || !this.instance;
    },
    handleHover() {
      this.$store.state.audio.playHoverEffect("ui/ta");
    },
    afterLoadingScreen(callback) {
      const wait = Math.max(
        0,
        LOADING_SCREEN_MIN_MS - (Date.now() - this.loadingScreenSince)
      );
      setTimeout(() => {
        if (this.isGone()) return;
        this.loadingScreen = false;
        if (callback) callback();
      }, wait);
    },
    handleCountdownFinished() {
      // [버그수정] 카운트다운이 끝났을 때 이미 곡이 끝났거나(페이드아웃/결과 이동 중)
      // 아직 시작 전이면 재개하지 않음. 그대로 두면 끝난 곡이 처음부터 다시 재생됨.
      if (!this.started || this.isGameEnded || this.isEndingSong) return;
      if (this.instance) {
        this.instance.resumeGame(false);
      }
    },
    async handleSongFinished() {
      if (this.isDemo) {
        // 곡이 끝나면 페이드아웃 후 타이틀로(타이틀에서 10초 뒤 다음 SAMPLE PLAY)
        if (this.isEndingSong) return;
        this.isEndingSong = true;
        this.songFadeOut = true;
        this.instance?.pauseVideo?.();
        setTimeout(this.exitDemo, SONG_END_FADE_DELAY_MS);
        return;
      }
      if (this.isGameEnded || this.isEndingSong) return;
      this.isEndingSong = true;
      this.songFadeOut = true;
      this.instance?.pauseVideo?.();
      await new Promise((resolve) => setTimeout(resolve, SONG_END_FADE_DELAY_MS));
      this.gameEnded(false);
    },
    songLoaded() {
      if (this.isGone()) return;
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
          this.afterLoadingScreen(() => this.startGameDirect());
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
      if (this.isGone()) return;
      Logger.log("audio loaded", audioPath);
      this.instance.loading = false;
      this.youtubeBuffering = false;
      if (!this.started && this.srcMode !== "youtube") {
        this.showStartButton = false;
        this.afterLoadingScreen(() => this.startGameDirect());
      }
    },
    handleAudioLoadError(error, audioPath) {
      if (this.isGone()) return;
      Logger.error("audio load error", audioPath, error);
      this.loadingScreen = false;
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
        if (this.isGone()) return;
        this.instance.startSong();
      } else {
        if (!this.tutorial) this.$refs.zoom.show("Get Ready...");
        // 스타트 후 4초 쿨타임 뒤에 음악/BGA 시작
        await new Promise((resolve) => setTimeout(resolve, GAME_START_DELAY_MS));
        if (this.isGone()) return;
        this.instance.startSong();
      }
      if (isDev) return;
      this.playId = await createPlay(
        this.currentSong.sheetId,
        this.currentSong.songId
      );
    },
    async startGameDirect() {
      if (this.isGone()) return;
      logEvent("start_game", { songId: this.currentSong.songId });
      this.health = 100;
      if (this.isDemo) {
        // 데모는 "Get Ready" 대기 없이 바로. 기본은 곡 끝까지, ?len=초가 있으면 그만큼만(리드인 2초 포함)
        this.instance.startSong();
        const len = Number(this.$route.query.len);
        if (len > 0) this.demoTimer = setTimeout(this.exitDemo, (len + 2) * 1000);
        return;
      }
      if (this.vs) {
        await this.vsWaitAndStart();
        return;
      }
      this.$refs.zoom.show("Get Ready...");
      // 스타트 후 4초 쿨타임 뒤에 음악/BGA 시작
      await new Promise((resolve) => setTimeout(resolve, GAME_START_DELAY_MS));
      if (this.isGone()) return;
      this.instance.startSong();
      if (isDev) return;
      this.playId = await createPlay(
        this.currentSong.sheetId,
        this.currentSong.songId
      );
    },
    // [LAN 대전] 로딩 완료를 호스트에 알리고, 호스트가 정한 시각에 모든 PC가 동시에 시작.
    // 호스트 시각 → 이 PC 시각 = startAt - offsetMs (offsetMs는 로비에서 /time 왕복으로 측정)
    async vsWaitAndStart() {
      this.$refs.zoom.show("Waiting...");
      vsLoaded();
      const startAt = await waitForStartAt(VS_FALLBACK_START_MS);
      if (this.isGameEnded || this.started || !this.instance) return;
      const offset = Number(this.vs && this.vs.offsetMs) || 0;
      let delay = 0;
      if (startAt) {
        this.vsStartAt = startAt;
        delay = Math.max(0, startAt - offset - Date.now());
      }
      setTimeout(() => {
        if (!this.isGameEnded && !this.started && this.instance) this.instance.startSong();
      }, delay);
    },
    // [대기 화면] 데모 중 입력: 게임 입력으로 전달하지 않고 타이틀로
    onDemoKey(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.exitDemo();
    },
    blockDemoPointer(e) {
      e.stopImmediatePropagation();
    },
    exitDemo() {
      if (this.demoExited) return;
      this.demoExited = true;
      clearTimeout(this.demoTimer);
      this.$router.push("/").catch(() => {});
    },
    triggerGameOverImmediate() {
      // [설정] No Fail: 체력이 0이 돼도 게임오버 없이 끝까지 진행
      // [LAN 대전] 대전 중에도 게임오버 없음(먼저 체력이 다 떨어져도 끝까지)
      if (this.noFail || this.vs) return;
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
      // [버그수정] 포커스 이탈 시 keyup이 오지 않아 하단 버튼 눌림 표시가 남던 문제 → 해제
      this.keyState = { key1: false, key2: false, key3: false, key4: false };
      // [버그수정] 곡 종료 페이드아웃(isEndingSong) 중에 창이 포커스를 잃으면
      // 일시정지 메뉴가 떠서 결과 화면 이동과 겹쳤음 → 이때도 무시.
      if (!this.started || this.isGameEnded || this.isEndingSong) return;
      // [LAN 대전] 대전 중엔 일시정지 없음(다른 PC와 시간이 어긋나므로). 누르던 키만 해제
      // [대기 화면] 데모도 창 포커스와 무관하게 계속 재생
      if (this.vs || this.isDemo) {
        this.instance?.releaseHeldKeys?.();
        return;
      }
      // [버그수정] 재개 카운트다운 도중 창이 포커스를 잃으면(blur) 일시정지 메뉴가 떠도
      // 카운트다운은 계속 돌아 3초 뒤 메뉴가 열린 채로 게임이 재개됐음 → 카운트다운 취소.
      this.$refs.countdown?.clear(false);
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
      // [버그수정] 로딩/"Get Ready" 중(시작 전)이나 곡 종료 페이드아웃 중에 ESC를 누르면
      // 여기로 들어와 카운트다운 → instance.resumeGame()이 실행되어, 시작 전에 음악이
      // 먼저 재생되거나(이후 startSong에서 한 번 더 재생 → 이중 재생/싱크 어긋남)
      // 끝난 곡이 다시 재생됐음. pauseGame()과 같은 조건으로 막는다.
      if (!this.started || this.isGameEnded || this.isEndingSong) return;
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
      // [버그수정] 예전엔 여기서 instance.paused = false로 바꿨는데, 재시작 시 오디오를
      // 다시 디코딩하는 동안(수백 ms) 게임 루프가 currentTime 0 기준으로 첫 노트들을 미리
      // 생성했고, 로딩이 끝난 뒤 startSong()이 같은 노트를 한 번 더 생성해 중복 노트
      // (한쪽은 무조건 BREAK)가 생겼음. 재개는 startSong() → resumeGame(true)가 담당하므로
      // 일시정지 상태를 유지한다.
      // resetPlaying() clears audioPath, and startSong() only reloads audio
      // when audioPath is set — keep it so a restart doesn't come back silent.
      const audioPath = this.instance.audioPath;
      this.instance.resetPlaying();
      this.instance.audioPath = audioPath;
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
      const playTime =
        this.gameInstance && Number.isFinite(Number(this.gameInstance.playTime))
          ? Number(this.gameInstance.playTime)
          : this.instance && Number.isFinite(Number(this.instance.playTime))
            ? Number(this.instance.playTime)
            : 0;
      const data = {
        status,
        playTime,
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
      // [축제 랭킹/미션] 오토플레이 결과는 기록 등록·미션 달성 불가로 표시
      this.result.autoPlay = !!(this.instance && this.instance.autoPlay);
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
        if (this.vs) {
          // [LAN 대전] 최종 결과 보고 후 대전 결과 화면으로(보고 실패해도 이동)
          const r = this.result;
          await vsFinish({
            score: r.score,
            accuracy: this.percentage,
            maxCombo: r.maxCombo,
            isFullCombo: r.marks.miss === 0,
            breaks: r.marks.miss,
          });
          this.$router.push({ path: "/vs", query: { result: res.data.resultId } });
        } else {
          this.$router.push("/result/" + res.data.resultId);
        }
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
    // 키 배치를 바꿔도 눌림 표시가 맞게 뜨도록 instance.trackKeyBind(실제 배치)를 기준으로 확인
    getUiKeyBind() {
      return (this.instance && this.instance.trackKeyBind) || ["d", "f", "j", "k"];
    },
    handleUIKeyDown(e) {
      const key = e.key.toLowerCase();
      const bind = this.getUiKeyBind();
      if (key === bind[0]) this.keyState.key1 = true;
      if (key === bind[1]) this.keyState.key2 = true;
      if (key === bind[2]) this.keyState.key3 = true;
      if (key === bind[3]) this.keyState.key4 = true;
    },
    handleUIKeyUp(e) {
      const key = e.key.toLowerCase();
      const bind = this.getUiKeyBind();
      if (key === bind[0]) this.keyState.key1 = false;
      if (key === bind[1]) this.keyState.key2 = false;
      if (key === bind[2]) this.keyState.key3 = false;
      if (key === bind[3]) this.keyState.key4 = false;
    },
  },
};
</script>

<style scoped>
/* [대기 화면] SAMPLE PLAY 표시(기어 위쪽 가운데, 입력/판정과 무관) */
.demo-banner {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  pointer-events: none;
  text-align: center;
  font-family: var(--dm-font-display);
  font-style: italic;
}
.demo-title {
  padding: 2px 24px;
  font-weight: 800;
  font-size: 34px;
  letter-spacing: 0.18em;
  color: #04121c;
  background: var(--dm-cyan);
  box-shadow: 0 0 30px rgba(var(--dm-cyan-rgb), 0.6);
}
.demo-sub {
  margin-top: 4px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.4em;
  color: var(--dm-text);
  animation: demo-blink 1.2s steps(2, start) infinite;
}
@keyframes demo-blink {
  to {
    visibility: hidden;
  }
}
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

/* [이펙트] 타격 이펙트 전용. 판정선(.gear-overlay z-index 4 안의 흰색 띠)에 가려지지 않도록 그 위에 둠.
   판정선 위치/크기는 그대로이고 쌓이는 순서만 다름. 클릭은 통과. */
#effectCanvas {
  z-index: 5;
  pointer-events: none;
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
  /* 4 lanes x 125px: thin lane dividers + a soft cyan wash toward the judgment line */
  background: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 124px,
      rgba(var(--dm-cyan-rgb), 0.16) 124px,
      rgba(var(--dm-cyan-rgb), 0.16) 125px
    ),
    linear-gradient(
      180deg,
      transparent 0%,
      transparent 60%,
      rgba(var(--dm-cyan-rgb), 0.1) 100%
    );
  border-left: 2px solid var(--dm-cyan);
  border-right: 2px solid var(--dm-cyan);
  box-shadow: 0 0 18px rgba(var(--dm-cyan-rgb), 0.35), inset 0 0 40px rgba(var(--dm-cyan-rgb), 0.06);
  pointer-events: none;
  z-index: 10;
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
  background: repeating-linear-gradient(
      135deg,
      rgba(var(--dm-cyan-rgb), 0.05) 0,
      rgba(var(--dm-cyan-rgb), 0.05) 2px,
      transparent 2px,
      transparent 14px
    ),
    linear-gradient(180deg, #0a1220 0%, #04070d 100%);
  border-left: 2px solid var(--dm-cyan);
  border-right: 2px solid var(--dm-cyan);
  box-sizing: border-box;
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
  /* [디자인 복원] 18px 전체가 꽉 찬 흰색 띠 + 글로우(원래 디자인).
     디자인 변경 때 '아래 4px만 흰색 + 위는 그라디언트'로 바뀌어 얇은 선처럼 보였음.
     위치/높이는 그대로, 그림만 원래대로. */
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
  background: linear-gradient(180deg, #0f1c2f 0%, #050a12 100%);
  border-top: 3px solid #2b415c;
  position: relative;
  transition: all 0.05s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--dm-font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 34px;
  color: #35506d;
}

.arcade-btn.d-key::after { content: "D"; }
.arcade-btn.f-key::after { content: "F"; }
.arcade-btn.j-key::after { content: "J"; }
.arcade-btn.k-key::after { content: "K"; }

/* outer lanes: ice white / inner lanes: cyan (same colors as the notes) */
.arcade-btn.d-key,
.arcade-btn.k-key {
  border-top-color: #b9d6ee;
}

.arcade-btn.f-key,
.arcade-btn.j-key {
  border-top-color: var(--dm-cyan);
}

/* 물리적으로 눌리는 느낌 (4px 하강) */
.arcade-btn.is-pressed {
  transform: translateY(4px);
  border-top: none;
}

/* D, K (outer lanes): ice white */
.arcade-btn.d-key.is-pressed,
.arcade-btn.k-key.is-pressed {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(220, 240, 255, 0.55) 0%, #050a12 100%);
  box-shadow: inset 0px 0px 22px rgba(220, 240, 255, 0.55);
}

/* F, J (inner lanes): cyan */
.arcade-btn.f-key.is-pressed,
.arcade-btn.j-key.is-pressed {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(var(--dm-cyan-rgb), 0.55) 0%, #050a12 100%);
  box-shadow: inset 0px 0px 22px rgba(var(--dm-cyan-rgb), 0.6);
}
</style>
