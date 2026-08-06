import GameInstance from "../javascript/gameInstance";

let pauseTime = 0;
let pauseTimeout = null;

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
        totalPercentage: 0,
        totalHitNotes: 0,
        combo: 0,
        maxCombo: 0,
        marks: { perfect: 0, good: 0, offbeat: 0, miss: 0 },
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
    }
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
    getDisplayedAccuracy() {
      return this._truncateDown(this.getTotalAccuracySixDecimals(), 2);
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
