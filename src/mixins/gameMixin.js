import GameInstance from "../javascript/gameInstance";

let pauseTime = 0;
let pauseTimeout = null;

const createJudgeSummary = () => ({
  max100: 0,
  max1To90: 0,
  break: 0,
});

const createJudgeDetails = () => ({
  "MAX 100%": 0,
  "MAX 90%": 0,
  "MAX 80%": 0,
  "MAX 70%": 0,
  "MAX 60%": 0,
  "MAX 50%": 0,
  "MAX 40%": 0,
  "MAX 30%": 0,
  "MAX 20%": 0,
  "MAX 10%": 0,
  "MAX 1%": 0,
  BREAK: 0,
});

// [UI] 결과 화면용 타이밍 통계(FAST/SLOW 개수, 평균 오차). 점수/판정 계산과는 무관.
const createTimingStats = () => ({ fast: 0, slow: 0, sumMs: 0, count: 0 });
// [미션] 롱노트 성공/실패 개수(미션 "롱노트 전부 성공" 평가용). 판정/점수와 무관.
const createLongStats = () => ({ cleared: 0, failed: 0 });

export default {
  data() {
    return {
      audio: null,
      canvas: null,
      ctx: null,
      effectCanvas: null,
      effectCtx: null,
      noteSpeed: 1,
      playbackSpeed: 1,
      playMode: true, // play or edit mode
      currentSong: null,
      result: {
        score: 0,
        accuracy: 0,
        totalPercentage: 0,
        totalHitNotes: 0,
        combo: 0,
        maxCombo: 0,
        marks: { perfect: 0, good: 0, offbeat: 0, miss: 0 },
        judgeSummary: createJudgeSummary(),
        judgeDetails: createJudgeDetails(),
        timing: createTimingStats(),
        longStats: createLongStats(),
      },
      fever: { value: 1, time: 0, percent: 0 },
      health: 100,
      feverInterval: null,
      srcMode: "youtube",
      instance: null,
      visualizerInstance: null,
      youtubeId: "caCqu-p_wZc",
      perspective: false,
      vibrate: true,
      noFail: false,
      fps: false,
      advancedMenuOptions: false,
      started: false,
      showStartButton: false,
      isGameEnded: false,
      initialized: false,
      blur: false,
      keyMap: null,
      keyBeamEnabled: true,
      noteEffectEnabled: true,
      // [설정] 새 설정 항목(기본값 = 기존 동작)
      audioOffsetMs: 0,
      laneCover: 0,
      bgaDim: 0.35,
      mirror: false,
      autoPlay: false,
      showFastSlow: false,
      fxEnabled: true, // [연출] 채보 연출 효과
      totalNoteCount: 0,
      scorePerJudge: 0,
      scoreAccRaw: 0,
    };
  },
  computed: {
    mode() {
      return this.playMode ? "Play Mode" : "Create Mode";
    },
    ytPlayer() {
      return this.$refs.youtube?.player;
    },
    hideGameForYtButton() {
      return this.srcMode === "youtube" && this.showStartButton;
    },
    percentage() {
      if (this.result.totalHitNotes === 0) return 0;
      const liveAvg = this.result.totalPercentage / this.result.totalHitNotes;
      return this._truncateDown(liveAvg, 2);
    },
  },
  watch: {
    noteSpeed() {
      // Only reposition before game start; once started, noteSpeed is session-locked
      if (!this.started && this.instance) this.instance.reposition();
    },
    showStartButton() {
      if (this.showStartButton) {
        this.$nextTick(this.addTilt);
        this.initialized = true;
      }
    },
    perspective() {
      this.instance.reposition();
    },
  },
  mounted() {
    this.canvas = this.$refs.mainCanvas;
    this.ctx = this.canvas.getContext("2d");
    this.effectCanvas = this.$refs.effectCanvas ?? this.canvas;
    this.effectCtx = this.effectCanvas.getContext("2d");
    this.visualizerInstance = this.$refs.visualizer;
    // get audio element
    this.audio = this.$store.state.audio;
    if (this.audio && typeof this.audio.stop === "function") {
      this.audio.stop(true);
    }

    this.feverInterval = setInterval(this.feverTimer, 500);

    // setup user default settings
    const gameSettings = this.$store.state?.userProfile?.gameSt;
    if (gameSettings) {
      this.blur = gameSettings.blur;
      this.noteSpeed = gameSettings.noteSpeed ?? 1;
      this.perspective = gameSettings.perspective;
      this.noFail = gameSettings.noFail;
      this.vibrate = gameSettings.vibrate;
      this.fps = gameSettings.fps;
      this.keyBeamEnabled = gameSettings.keyBeamEnabled ?? true;
      this.noteEffectEnabled = gameSettings.noteEffectEnabled ?? true;
      // [설정] 값이 없으면 기본값(기존 동작) 유지
      this.audioOffsetMs = Number(gameSettings.audioOffsetMs) || 0;
      this.laneCover = Number(gameSettings.laneCover) || 0;
      const dim = Number(gameSettings.bgaDim ?? 0.35);
      this.bgaDim = Number.isFinite(dim) ? dim : 0.35;
      this.mirror = gameSettings.mirror === true;
      this.showFastSlow = gameSettings.showFastSlow === true;
      this.fxEnabled = gameSettings.fxEnabled !== false;
    }
    // 오토플레이는 저장하지 않는 이번 실행 한정 설정(store)
    this.autoPlay = this.$store.state.autoPlay === true;
    const preference = this.$store.state?.userProfile?.preference;
    if (preference) {
      this.keyMap = preference.keyMap;
    }
    Logger.log(this.keyMap);

    // init instance
    this.instance = new GameInstance(this);
    this.instance.reposition();

    window.addEventListener("blur", this.pauseGame);
  },
  beforeDestroy() {
    clearInterval(this.feverInterval);
    window.removeEventListener("blur", this.pauseGame);
    if (this.audio && typeof this.audio.stop === "function") {
      this.audio.stop(true);
    }
    if (this.instance && typeof this.instance.destroyInstance === "function") {
      this.instance.destroyInstance();
    }
    this.instance = null;
  },
  methods: {
    _truncateDown(value, digits) {
      const base = Math.pow(10, digits);
      return Math.floor((Number(value) || 0) * base) / base;
    },
    getTotalAccuracySixDecimals() {
      const totalCount = Math.max(1, Number(this.totalNoteCount || 0));
      const avg = this.result.totalPercentage / totalCount;
      return this._truncateDown(avg, 6);
    },
    setTotalNoteCount(totalCount) {
      const safeCount = Math.max(1, Number(totalCount) || 1);
      this.totalNoteCount = safeCount;
      this.scorePerJudge = 1000000 / safeCount;
      this.scoreAccRaw = 0;
      if (this.result) {
        this.result.score = 0;
        this.result.totalPercentage = 0;
        this.result.totalHitNotes = 0;
      }
    },
    recalculateScoreAndAccuracy() {
      const totalAccuracy = this.getTotalAccuracySixDecimals();
      this.result.accuracy = totalAccuracy;
      this.result.score = Math.max(
        0,
        Math.min(1000000, Math.floor(totalAccuracy * 10000))
      );
    },
    registerJudgePercent(percentValue) {
      const safePercent = Math.max(0, Math.min(100, Number(percentValue) || 0));
      this.result.totalHitNotes += 1;
      this.result.totalPercentage += safePercent;

      // Live score increases from 0 by pre-allocated per-judgement value.
      const perJudge =
        this.scorePerJudge > 0
          ? this.scorePerJudge
          : 1000000 / Math.max(1, Number(this.totalNoteCount || 1));
      this.scoreAccRaw += perJudge * (safePercent / 100);
      this.result.score = Math.max(0, Math.min(1000000, Math.floor(this.scoreAccRaw)));
    },
    // [UI] 누른 타이밍 기록(+ 늦음 / - 빠름, ms). FAST/SLOW는 MAX 100% 미만만 셈(IIDX 방식)
    registerTiming(signedMs, displayPercent) {
      if (!Number.isFinite(signedMs)) return;
      const t = this.result.timing || (this.result.timing = createTimingStats());
      t.sumMs += signedMs;
      t.count += 1;
      if (displayPercent < 100) {
        if (signedMs < 0) t.fast += 1;
        else t.slow += 1;
      }
    },
    registerJudgeLabel(judgeText) {
      const label = String(judgeText || "BREAK");
      if (!this.result.judgeSummary) {
        this.result.judgeSummary = createJudgeSummary();
      }
      if (!this.result.judgeDetails) {
        this.result.judgeDetails = createJudgeDetails();
      }

      if (Object.prototype.hasOwnProperty.call(this.result.judgeDetails, label)) {
        this.result.judgeDetails[label] += 1;
      } else {
        this.result.judgeDetails[label] = 1;
      }

      if (label === "BREAK") {
        this.result.judgeSummary.break += 1;
      } else if (label === "MAX 100%") {
        this.result.judgeSummary.max100 += 1;
      } else {
        this.result.judgeSummary.max1To90 += 1;
      }
    },
    finalizeResultMetrics() {
      this.recalculateScoreAndAccuracy();
    },
    clearResult() {
      this.result = {
        score: 0,
        accuracy: 0,
        totalPercentage: 0,
        totalHitNotes: 0,
        combo: 0,
        maxCombo: 0,
        marks: { perfect: 0, good: 0, offbeat: 0, miss: 0 },
        judgeSummary: createJudgeSummary(),
        judgeDetails: createJudgeDetails(),
        timing: createTimingStats(),
        longStats: createLongStats(),
      };
      this.scoreAccRaw = 0;
      this.scorePerJudge =
        this.totalNoteCount > 0 ? 1000000 / this.totalNoteCount : 0;
      this.clearFever();
    },
    clearFever() {
      this.fever = { value: 1, time: 0, percent: 0 };
    },
    feverTimer() {
      if (!this.started || this.instance.paused || !this.playMode) return;
      if (this.fever.value < 1) this.fever.value = 1;
      if (this.fever.percent < 0) this.fever.percent = 0;
      if (this.fever.percent >= 1) {
        this.fever.percent = 0;
        this.fever.time = 30;
        this.fever.value =
          this.fever.value < 5 ? this.fever.value + 1 : this.fever.value;
        this.$refs?.zoom?.show("X" + this.fever.value, "45%", "fever");
        this.$store.state.audio.playEffect("explode");
      }
      if (this.fever.time > 0) {
        this.fever.time -= 0.5;
      } else if (this.fever.value > 1) {
        this.clearFever();
      }
    },
    ytPaused() {
      Logger.log("pasued");
      if (pauseTime > 10) {
        this.$store.state.alert.error(
          "Player anomoly detected, pause failed",
          2000
        );
        return;
      }
      if (this.started) this.pauseGame();
      pauseTime++;
      clearTimeout(pauseTimeout);
      pauseTimeout = setTimeout(() => {
        pauseTime = 0;
      }, 1000);
    },
    ytError() {
      Logger.error("youtube error");
      this.instance.loading = false;
      this.$store.state.gModal.show({
        bodyText:
          "Sorry, there is a problem with the source right now, which makes this sheet unavaliable. Please try again later.",
        isError: true,
        showCancel: false,
        okCallback: this.exitGame,
      });
    },
  },
};
