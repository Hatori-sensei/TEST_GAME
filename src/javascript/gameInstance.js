import DropTrack from "./track";
import FeverEffect from "./FeverEffect";
import { Howl, Howler } from "howler";
import { resolveMediaUrl } from "../utils/pathResolver";

const LEAD_IN_SEC = 2;
const SHOW_FPS = true;
const KeyCode = { KEY_LEFT: 37, KEY_RIGHT: 39, ESC: 27, P: 80, SPACE: 32 };

export default class GameInstance {
  constructor(vm) {
    this.canvas = vm.canvas;
    this.ctx = vm.ctx;
    this.effectCanvas = vm.effectCanvas;
    this.effectCtx = vm.effectCtx;
    this.audio = vm.audio;
    this.vm = vm;
    this.timeArr = [];
    this.timeArrIdx = 0;
    this.currentTime = 0;
    this.playTime = 0;
    this.paused = true;
    this.keyHoldingStatus = {};
    this.howl = null;
    this.html5 = false;
    this.audioPath = null;
    this.videoElement = null;
    this.loading = false;
    this.songDurationSeconds = 0;
    this.usingFallbackNotes = false;
    this.currentHowlId = null;
    this.songEndedNotified = false;
    this.gimmicks = [];
    this.reverseGimmicks = [];
    this.visualTimeline = [];
    this.visualSpeedEvents = [];
    this.visualStopIntervals = [];
    this.currentGlobalVisualPos = 0;
    this.isReverse = false;
    this.reverseBlend = 0;
    this.enableRandomGimmicks = false;
    this.randomGimmickMode = "off";

    this.feverEff = new FeverEffect(vm, this);
    this.createTracks(4);
    this.registerInput();
    this.resumeAudioContext();
    this.destoryed = false;
    this.update();
  }

  resolveRuntimeMediaUrl(rawPath) {
    return resolveMediaUrl(rawPath);
  }

  getConfiguredBgmVolume() {
    const fromStore = Number(this.vm?.$store?.state?.audio?.maxVolume);
    if (Number.isFinite(fromStore)) {
      return Math.min(1, Math.max(0, fromStore));
    }

    const fromAudio = Number(this.audio?.maxVolume);
    if (Number.isFinite(fromAudio)) {
      return Math.min(1, Math.max(0, fromAudio));
    }

    return 0.7;
  }

  applyConfiguredBgmVolume() {
    if (!this.howl || typeof this.howl.volume !== "function") return;
    this.howl.volume(this.getConfiguredBgmVolume());
  }

  getNoteSpawnLeadSec() {
    const speed = Math.max(1e-6, Number(this.noteSpeedPxPerSec) || 1);
    // Keep notes off-screen initially so they enter from outside the top edge.
    const hiddenTopPaddingPx = 180;
    const hitLineY = Math.max(0, Number(this.checkHitLineY) || 0);
    return (hitLineY + hiddenTopPaddingPx) / speed;
  }

  createTracks(trackNum) {
    this.dropTrackArr = [];
    this.trackNum = trackNum;
    this.setUserKeyBind();
    for (const keyBind of this.trackKeyBind) {
      this.dropTrackArr.push(new DropTrack(this.vm, this, 0, 150, keyBind));
    }
    this.reposition();
  }

  setUserKeyBind() {
    // 4키 기본 배치(d,f,j,k)에 곡 선택 화면에서 저장한 keyMap을 적용.
    // 매핑이 없거나 비어있으면 기본 키로 폴백.
    const defaultBind = ["d", "f", "j", "k"];
    const keyMap = this.vm && this.vm.keyMap;
    this.trackKeyBind = defaultBind.map((defKey) => {
      const mapped = keyMap && keyMap[defKey];
      return typeof mapped === "string" && mapped
        ? mapped.toLowerCase()
        : defKey;
    });
    this.userKeyBind = this.trackKeyBind;
    this.reverseKeyMap = {};
  }

  getKeyName(keyEvent) {
    return keyEvent.key.toLowerCase();
  }

  async reposition() {
    // Match the bitmap to the element's real rendered size. The CSS judgment
    // line is positioned inside this container, so using window.innerHeight
    // (which can differ during F11/zoom) would stretch the canvas and shift
    // the notes relative to the drawn judgment line.
    const wrapper = this.vm.wrapper || this.canvas.parentElement;
    this.canvas.width = wrapper?.clientWidth || window.innerWidth;
    this.canvas.height = wrapper?.clientHeight || window.innerHeight;
    this.effectCanvas.width = this.canvas.width;
    this.effectCanvas.height = this.canvas.height;

    // 🚨 1. 기어 넓이 충돌 완벽 해결!
    // 캔버스 기어 넓이가 화면마다 변하던 것을 CSS(500px)와 똑같이 맞춥니다.
    // 4키 기준, 1개당 125px로 고정하면 총 500px로 양옆 기어가 딱 맞아떨어집니다.
    const trackWidth = 125;
    const startX = this.canvas.width / 2 - (this.trackNum * trackWidth) / 2;

    this.dropTrackArr.forEach((track, i) => {
      track.resizeTrack(startX + trackWidth * i, trackWidth);
    });

    this.startX = startX;
    this.endX = startX + trackWidth * this.trackNum;

    // 🚨 2. 판정선 위치 충돌 완벽 해결!
    // 캔버스가 자기 멋대로 곱하기(* 0.82) 하던 것을 CSS와 똑같이 바닥에서 140px로 고정합니다.
    this.checkHitLineY = this.canvas.height - 320;

    // noteSpeedPxPerSec is derived from a session-locked multiplier to avoid runtime changes
    let sessionMultiplier;
    if (this.sessionSpeedMultiplier !== undefined) {
      sessionMultiplier = this.sessionSpeedMultiplier;
    } else if (this.vm && this.vm.started) {
      // Game already started but sessionSpeedMultiplier not set (race); lock from store and prevent reading live vm.noteSpeed thereafter
      const storeSpeed =
        this.vm.$store &&
        this.vm.$store.state &&
        this.vm.$store.state.speedMultiplier
          ? this.vm.$store.state.speedMultiplier
          : undefined;
      sessionMultiplier =
        storeSpeed !== undefined ? storeSpeed : this.vm.noteSpeed || 1.0;
      this.sessionSpeedMultiplier = sessionMultiplier;
    } else {
      // Pre-start: use configured vm.noteSpeed but do NOT treat as mutable during a running session
      sessionMultiplier = this.vm.noteSpeed || 1.0;
    }
    this.noteSpeedPxPerSec =
      400 * sessionMultiplier * (this.vm.playbackSpeed || 1);
    this.noteDelay = this.checkHitLineY / this.noteSpeedPxPerSec;
    this.noteSpawnLeadSec = this.getNoteSpawnLeadSec();

    // Only re-derive the spawn cursor before a song starts. Once running,
    // timeArrIdx tracks which notes have already been spawned — recomputing
    // it here (e.g. on a mid-song resize) would re-spawn or skip notes.
    if (!this.vm || !this.vm.started) {
      const foundIdx = this.timeArr.findIndex((e) => e.t > this.currentTime);
      this.timeArrIdx = foundIdx !== -1 ? foundIdx : 0;
    }
  }

  loadAudio(audioPath) {
    if (!audioPath) return Promise.reject(new Error("Audio path is required"));
    const resolvedAudioPath = this.resolveRuntimeMediaUrl(audioPath);
    if (this.howl && this.audioPath === resolvedAudioPath) {
      if (
        typeof this.howl.state === "function" &&
        this.howl.state() === "loaded"
      ) {
        this.applyConfiguredBgmVolume();
        if (this.vm && this.vm.instance) this.vm.instance.loading = false;
        return Promise.resolve(this.howl);
      }
      return new Promise((resolve, reject) => {
        this.howl.once("load", () => resolve(this.howl));
        this.howl.once("loaderror", (id, err) => reject(err));
      });
    }
    if (this.howl && typeof this.howl.unload === "function") {
      this.howl.unload();
    }
    this.audioPath = resolvedAudioPath;
    this.loading = true;
    this.howl = new Howl({
      src: [resolvedAudioPath],
      html5: this.html5,
      format: ["mp3"],
      onload: () => {
        this.loading = false;
        this.applyConfiguredBgmVolume();
        const loadedDuration =
          this.howl && typeof this.howl.duration === "function"
            ? Number(this.howl.duration())
            : 0;
        if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
          this.songDurationSeconds = loadedDuration;
          if (this.vm && this.vm.currentSong) {
            this.vm.currentSong.runtimeLength = loadedDuration;
          }

          if (this.usingFallbackNotes) {
            const currentLastNoteTime = this.timeArr.reduce((maxTime, noteObj) => {
              const t = Number(noteObj?.startTime ?? noteObj?.t ?? 0);
              return Number.isFinite(t) && t > maxTime ? t : maxTime;
            }, 0);

            if (currentLastNoteTime < loadedDuration * 0.9) {
              const fallbackSong = {
                ...(this.vm?.currentSong || {}),
                length: loadedDuration,
              };
              let regeneratedNotes = this._normalizeRandomNotes(
                this._generateFallbackNotes(fallbackSong),
                fallbackSong
              );
              if (this.enableRandomGimmicks) {
                const randomBundle = this._generateRandomFallbackGimmicksAndShifts(
                  regeneratedNotes,
                  fallbackSong,
                  this.randomGimmickMode
                );
                regeneratedNotes = randomBundle.notes;
                this.gimmicks = randomBundle.gimmicks;
                if (this.vm && this.vm.currentSong) {
                  this.vm.currentSong.gimmicks = this.gimmicks;
                }
              }

              this.timeArr = regeneratedNotes;
              this.bakeVisualPositions(this.timeArr, this.gimmicks);
              this.timeArrIdx = 0;
              if (this.vm) {
                const longNoteCount = this.timeArr.reduce((count, noteObj) => {
                  const start = Number(noteObj?.startTime ?? noteObj?.t ?? 0);
                  const endFromObj = noteObj?.endTime;
                  const len = Number(noteObj?.l ?? 0);
                  const end =
                    endFromObj !== undefined
                      ? Number(endFromObj)
                      : Number.isFinite(start) && Number.isFinite(len)
                      ? start + len
                      : start;
                  return end > start ? count + 1 : count;
                }, 0);
                const plannedJudgementCount = this.timeArr.length + longNoteCount;
                if (typeof this.vm.setTotalNoteCount === "function") {
                  this.vm.setTotalNoteCount(plannedJudgementCount);
                } else {
                  this.vm.totalNoteCount = plannedJudgementCount;
                }
              }
            }
          }
        }
        if (this.vm && this.vm.instance) this.vm.instance.loading = false;
        if (this.vm && typeof this.vm.onAudioLoaded === "function") {
          this.vm.onAudioLoaded(resolvedAudioPath);
        }
      },
      onloaderror: (id, err) => {
        this.loading = false;
        if (this.vm && this.vm.instance) this.vm.instance.loading = false;
        console.error("Howl load error", resolvedAudioPath, id, err);
        if (this.vm && typeof this.vm.handleAudioLoadError === "function") {
          this.vm.handleAudioLoadError(err, resolvedAudioPath);
          return;
        }
        this._handleAudioLoadError(err, resolvedAudioPath);
      },
      onplayerror: (id, err) => {
        console.warn("Howl play error", resolvedAudioPath, id, err);
        if (this.howl && typeof this.howl.once === "function") {
          this.howl.once("unlock", () => {
            if (this.howl && typeof this.howl.play === "function") {
              this.howl.play();
            }
          });
        }
        this.resumeAudioContext().then(() => {
          if (this.howl && typeof this.howl.play === "function") {
            this.howl.play();
          }
        });
      },
      onend: () => {
        if (this.songEndedNotified) return;
        this.songEndedNotified = true;
        this.paused = true;
        this.pauseVideo();
        if (this.vm && typeof this.vm.handleSongFinished === "function") {
          this.vm.handleSongFinished();
        }
      },
    });
    // A cached buffer (e.g. on restart) makes Howler emit "load" inside the
    // constructor, before any listener can be attached — resolve right away.
    if (this.howl.state() === "loaded") {
      this.applyConfiguredBgmVolume();
      return Promise.resolve(this.howl);
    }
    return new Promise((resolve, reject) => {
      this.howl.once("load", () => {
        this.applyConfiguredBgmVolume();
        resolve(this.howl);
      });
      this.howl.once("loaderror", (id, err) => reject(err));
    });
  }

  setVideoElement(videoElement) {
    this.videoElement = videoElement || null;
    if (!this.videoElement) return;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.preload = "auto";
    if (!this.paused) {
      this.playVideo();
    }
  }

  seekTo(time) {
    if (this.howl && typeof this.howl.seek === "function") {
      this.howl.seek(time);
    }
    if (
      this.videoElement &&
      typeof this.videoElement.currentTime !== "undefined"
    ) {
      try {
        this.videoElement.currentTime = time;
      } catch (e) {
        // ignore invalid seek while video is not ready
      }
    }
  }

  playVideo() {
    if (!this.videoElement || typeof this.videoElement.play !== "function") {
      return;
    }
    this.videoElement.play().catch(() => {});
  }

  pauseVideo() {
    if (!this.videoElement || typeof this.videoElement.pause !== "function") {
      return;
    }
    this.videoElement.pause();
  }

  registerInput() {
    this.keydownEvent = (event) => {
      this.resumeAudioContext();
      const key = this.getKeyName(event);
      if (event.keyCode === KeyCode.ESC) {
        event.preventDefault();
        if (this.paused) {
          if (this.vm && typeof this.vm.resumeGame === "function") {
            this.vm.resumeGame(true);
          } else {
            this.resumeGame(false);
          }
        } else if (this.vm && typeof this.vm.pauseGame === "function") {
          this.vm.pauseGame();
        } else {
          this.pauseGame();
        }
        return;
      }

      // Pause 상태에서는 노트 입력 판정을 완전히 차단
      if (this.paused) {
        return;
      }

      // Removed in-game speed adjustment keys to keep speed constant during gameplay
      this.onKeyDown(key);
    };
    this.pointerdownEvent = () => {
      this.resumeAudioContext();
    };
    this.keyupEvent = (event) => this.onKeyUp(this.getKeyName(event));
    this.resizeHandler = () => {
      // reposition() keeps noteSpeedPxPerSec locked via sessionSpeedMultiplier
      // once a song has started, so it's safe to run on every resize — this
      // keeps the judge line and track x-positions aligned with the canvas
      // even if the window/zoom changes mid-song.
      this.reposition();
      // F11/zoom fire several resize events while the layout is still
      // settling — re-measure once it has.
      clearTimeout(this.resizeSettleTimer);
      this.resizeSettleTimer = setTimeout(() => this.reposition(), 200);
    };
    window.addEventListener("resize", this.resizeHandler);
    document.addEventListener("keydown", this.keydownEvent);
    document.addEventListener("pointerdown", this.pointerdownEvent);
    document.addEventListener("keyup", this.keyupEvent);
  }

  async resumeAudioContext() {
    const ctx = Howler && Howler.ctx;
    if (!ctx || ctx.state !== "suspended") return;
    try {
      await ctx.resume();
    } catch (error) {
      // keep silent; next user input will retry
    }
  }

  destroyInstance() {
    // stop the main loop
    this.destoryed = true;
    // remove DOM event listeners
    try {
      if (this.keydownEvent) {
        document.removeEventListener("keydown", this.keydownEvent);
      }
      if (this.keyupEvent) {
        document.removeEventListener("keyup", this.keyupEvent);
      }
      if (this.pointerdownEvent) {
        document.removeEventListener("pointerdown", this.pointerdownEvent);
      }
      if (this.resizeHandler) {
        window.removeEventListener("resize", this.resizeHandler);
      }
      clearTimeout(this.resizeSettleTimer);
    } catch (e) {
      // ignore
    }
    // clear timers/intervals
    try {
      clearInterval(this.intervalPlay);
    } catch (e) {
      // ignore
    }
    try {
      if (this.howl && typeof this.howl.pause === "function") this.howl.pause();
    } catch (e) {
      // ignore
    }
    // clear track arrays
    try {
      this.dropTrackArr.forEach((track) => {
        if (
          track.particleEffect &&
          typeof track.particleEffect.clear === "function"
        ) {
          track.particleEffect.clear();
        }
        track.noteArr = [];
      });
    } catch (e) {
      // ignore
    }
  }

  async onKeyDown(key) {
    if (this.keyHoldingStatus[key]) return;
    this.keyHoldingStatus[key] = true;
    this.dropTrackArr.forEach((track) => track.keyDown(key));
  }

  async onKeyUp(key) {
    this.keyHoldingStatus[key] = false;

    // Pause 상태에서의 keyup은 키 상태만 해제하고 판정 로직은 막는다.
    if (this.paused) {
      return;
    }

    this.dropTrackArr.forEach((track) => track.keyUp(key));
  }

  update(_time) {
    if (this.destoryed) return;
    requestAnimationFrame(this.update.bind(this));
    this.sampleFps(typeof _time === "number" ? _time : performance.now());

    if (!this.paused) {
      if (this.leadInRemaining > 0) this.updateLeadIn();
      else this.updateCurrentTime();
      this.gameTimingLoop();
    }

    if (typeof this.onTick === "function") {
      this.onTick({
        audioTime: Math.max(0, this.currentTime),
        paused: this.paused,
      });
    }

    if (
      this.videoElement &&
      !this.videoElement.paused &&
      typeof this.videoElement.currentTime === "number"
    ) {
      const drift = Math.abs(this.videoElement.currentTime - this.currentTime);
      // Only correct noticeable desync, and not more often than every 500ms —
      // seeking every frame on small (~50ms) drift causes visible video stutter.
      const now = performance.now();
      if (
        drift >= 0.2 &&
        (!this.lastVideoSyncAt || now - this.lastVideoSyncAt >= 500)
      ) {
        try {
          this.videoElement.currentTime = this.currentTime;
          this.lastVideoSyncAt = now;
        } catch (e) {
          // ignore invalid seek while video is not ready
        }
      }
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.effectCtx.clearRect(
      0,
      0,
      this.effectCanvas.width,
      this.effectCanvas.height
    );

    this.drawDecoration();
    this.dropTrackArr.forEach((track) => track.update());
    this.drawUI();
    this.drawFps();
  }

  sampleFps(now) {
    if (this.fpsWindowStart === undefined) {
      this.fpsWindowStart = now;
      this.fpsLastFrame = now;
      this.fpsFrames = 0;
      this.fpsWorstMs = 0;
      return;
    }
    this.fpsFrames += 1;
    this.fpsWorstMs = Math.max(this.fpsWorstMs, now - this.fpsLastFrame);
    this.fpsLastFrame = now;
    const elapsed = now - this.fpsWindowStart;
    if (elapsed >= 500) {
      this.fpsValue = (this.fpsFrames * 1000) / elapsed;
      this.fpsShownWorstMs = this.fpsWorstMs;
      this.fpsWindowStart = now;
      this.fpsFrames = 0;
      this.fpsWorstMs = 0;
    }
  }

  drawFps() {
    if (!SHOW_FPS || this.fpsValue === undefined) return;
    this.ctx.save();
    this.ctx.textAlign = "left";
    this.ctx.font = '600 16px "Barlow Condensed", monospace';
    this.ctx.fillStyle = this.fpsValue < 50 ? "#ff5a5a" : "#7dff9a";
    this.ctx.fillText(
      `FPS ${this.fpsValue.toFixed(0)}  (worst ${this.fpsShownWorstMs.toFixed(1)}ms)`,
      64,
      36
    );
    this.ctx.restore();
  }

  drawUI() {
    const currentSpeed = (
      this.sessionSpeedMultiplier !== undefined
        ? this.sessionSpeedMultiplier
        : this.vm.noteSpeed || 1.0
    ).toFixed(1);
    this.ctx.save();
    this.ctx.textAlign = "right";
    this.ctx.fillStyle = "#7f95ab";
    this.ctx.font = 'italic 700 18px "Barlow Condensed", sans-serif';
    this.ctx.fillText(`SPEED x${currentSpeed}`, this.endX - 12, 28);
    this.ctx.restore();
  }

  drawDecoration() {
    // 배경 (블랙)

    // 🚨 노트보다 먼저 도화지에 그려지는 반투명 기어 배경
    this.ctx.fillStyle = "rgba(3, 7, 14, 0.8)";
    this.ctx.fillRect(
      this.startX,
      0,
      this.endX - this.startX,
      this.canvas.height
    );

    // 🚨 여기서부터 캔버스가 그리던 '과거의 쓰레기 UI' 코드를 전부 지워버렸습니다! 🚨
    // (예전 회색 하단 박스 삭제)
    // (예전 분홍색 양옆 테두리 삭제)
    // (예전 겹쳐 보이던 빨간색 가로 판정선 삭제)
  }

  // 🎧 오디오 재생 시간 동기화는 Howl의 seek() 기반으로 유지합니다.
  async updateCurrentTime() {
    let cTime = 0;
    if (this.howl && typeof this.howl.seek === "function") {
      const seekValue = this.howl.seek();
      cTime = typeof seekValue === "number" ? seekValue : 0;
    }
    this.currentTime = cTime || 0;
    this.currentGlobalVisualPos = this.getVisualPositionAtTime(this.currentTime);
    this.isReverse = false;
    this.reverseBlend = 0;
    // Spawn lead is based on travel time to judgment line so notes enter naturally.
    const spawnLeadSec =
      Number.isFinite(Number(this.noteSpawnLeadSec)) && Number(this.noteSpawnLeadSec) > 0
        ? Number(this.noteSpawnLeadSec)
        : this.getNoteSpawnLeadSec();
    this.playTime = this.currentTime + spawnLeadSec;
  }

  // Before the audio starts, run a virtual clock into negative time so the
  // first notes scroll in from above instead of popping up mid-screen.
  updateLeadIn() {
    const now = performance.now();
    const dt = this.leadInLastTick === null ? 0 : (now - this.leadInLastTick) / 1000;
    this.leadInLastTick = now;
    this.leadInRemaining -= dt;

    if (this.leadInRemaining <= 0) {
      this.leadInRemaining = 0;
      this.leadInLastTick = null;
      this.playMedia();
      this.updateCurrentTime();
      return;
    }

    this.currentTime = (Number(this.startSongAt) || 0) - this.leadInRemaining;
    this.currentGlobalVisualPos = this.getVisualPositionAtTime(this.currentTime);
    this.isReverse = false;
    this.reverseBlend = 0;
    const spawnLeadSec =
      Number.isFinite(Number(this.noteSpawnLeadSec)) &&
      Number(this.noteSpawnLeadSec) > 0
        ? Number(this.noteSpawnLeadSec)
        : this.getNoteSpawnLeadSec();
    this.playTime = this.currentTime + spawnLeadSec;
  }

  async startSong() {
    clearInterval(this.intervalPlay);
    this.timeArrIdx = 0;
    this.dropTrackArr.forEach((track) => (track.noteArr = []));
    this.vm.started = true;
    this.songEndedNotified = false;
    this.currentHowlId = null;

    // Lock the session speed at song start to prevent runtime changes
    const storeSpeed =
      this.vm.$store &&
      this.vm.$store.state &&
      this.vm.$store.state.speedMultiplier
        ? this.vm.$store.state.speedMultiplier
        : undefined;
    this.sessionSpeedMultiplier =
      storeSpeed !== undefined ? storeSpeed : this.vm.noteSpeed || 1.0;

    this.reposition();
    if (this.audioPath && !this.howl) {
      try {
        await this.loadAudio(this.audioPath).catch((err) => {
          console.error("Audio load failed:", err);
        });
      } catch (err) {
        console.error("Audio load failed:", err);
      }
    }
    this.noteSpawnLeadSec = this.getNoteSpawnLeadSec();

    // When starting from a non-zero chart offset, skip notes that are too old to be visible.
    const startTimeSec = Math.max(0, Number(this.startSongAt) || 0);
    const visibleWindowStart = Math.max(0, startTimeSec - this.noteSpawnLeadSec);
    const foundStartIdx = Array.isArray(this.timeArr)
      ? this.timeArr.findIndex((noteObj) => {
          if (!noteObj || typeof noteObj !== "object") return false;
          const start = Number(noteObj.startTime ?? noteObj.t ?? 0);
          const endFromObj = noteObj.endTime;
          const len = Number(noteObj.l ?? 0);
          const end =
            endFromObj !== undefined
              ? Number(endFromObj)
              : Number.isFinite(start) && Number.isFinite(len)
              ? start + len
              : start;
          if (!Number.isFinite(start)) return false;
          // Include notes whose head enters soon, and long notes whose tail can still be visible.
          return start >= visibleWindowStart || (Number.isFinite(end) && end >= visibleWindowStart);
        })
      : -1;
    const startIdx = foundStartIdx !== -1 ? foundStartIdx : this.timeArr.length;
    this.timeArrIdx = startIdx;

    // Notes are spawned incrementally as they come due (see gameTimingLoop(),
    // called every frame from update()) rather than all at once here — a long
    // chart would otherwise create thousands of off-screen Note instances that
    // all still run update() every frame.
    this.resumeGame(true);
  }

  resolvePlayableKey(noteObj) {
    // 노트의 key(0~3) 인덱스를 실제 트랙 키 배치(trackKeyBind)로 변환.
    // 예전엔 항상 "d/f/j/k" 고정값을 썼는데, 그러면 키 배치를 바꿔도
    // 노트 스폰은 여전히 원래 키로 라우팅돼서 엉뚱한 레인으로 가거나
    // (바뀐 키가 기본 d/f/j/k와 겹치지 않으면) 아예 매칭되는 트랙이 없어
    // 노트가 내려오지 않는 버그가 있었음.
    const fallbackKeys = this.trackKeyBind || ["d", "f", "j", "k"];
    let k = noteObj?.k;
    if (k === undefined && noteObj?.key !== undefined) {
      k = fallbackKeys[noteObj.key];
    }
    return typeof k === "string" ? k.toLowerCase() : null;
  }

  // Spawns notes once they are within a screen's height above the judge line.
  // Uses visual (gimmick-aware) distance, not time, so speed-ups never let a
  // note pop into view already on screen. visualPos is monotonic non-decreasing.
  // Shared by the per-frame game loop and the sheet editor's seek/scrub preview.
  async gameTimingLoop() {
    if (this.paused) return;

    const speed = Math.max(1e-6, Number(this.noteSpeedPxPerSec) || 1);
    const spawnDistancePx = (Number(this.checkHitLineY) || 0) + 250;
    const globalPos = Number(this.currentGlobalVisualPos) || 0;

    while (this.timeArr && this.timeArrIdx < this.timeArr.length) {
      const noteObj = this.timeArr[this.timeArrIdx];
      const noteStartTime = noteObj.startTime ?? noteObj.t;
      if (noteStartTime === undefined) {
        this.timeArrIdx++;
        continue;
      }

      const visualPos = Number(noteObj.visualPos);
      const isDue = Number.isFinite(visualPos)
        ? (visualPos - globalPos) * speed <= spawnDistancePx
        : noteStartTime <= this.playTime;
      if (!isDue) break;

      const k = this.resolvePlayableKey(noteObj);

      if (k) {
        this.dropTrackArr.forEach((track) => track.dropNote(k, noteObj));
      }
      this.timeArrIdx++;
    }
  }

  resetPlaying() {
    clearInterval(this.intervalPlay);
    this.vm.started = false;
    this.timeArrIdx = 0;
    this.dropTrackArr.forEach((track) => (track.noteArr = []));
    if (this.howl && typeof this.howl.unload === "function") {
      this.howl.unload();
    }
    this.howl = null;
    this.audioPath = null;
    this.leadInRemaining = 0;
    this.leadInLastTick = null;
    this.loading = false;
    this.songDurationSeconds = 0;
    this.usingFallbackNotes = false;
    this.currentHowlId = null;
    this.songEndedNotified = false;
  }

  loadSong(song, options = {}) {
    this.resetPlaying();
    this.randomGimmickMode = this._normalizeRandomGimmickMode(
      options?.randomGimmickMode,
      options?.enableRandomGimmicks
    );
    this.enableRandomGimmicks = this.randomGimmickMode !== "off";
    const resolvedAudioPath = resolveMediaUrl(song.audioPath || song.url);
    const resolvedBgaPath = resolveMediaUrl(song.bgaPath);
    this.vm.currentSong = {
      ...song,
      audioPath: resolvedAudioPath,
      bgaPath: resolvedBgaPath,
    };
    this.vm.srcMode = "local";
    this.audioPath = resolvedAudioPath;

    let rawNotes = song.sheet ?? song.notes ?? [];
    let parsedNotes = [];
    if (typeof rawNotes === "string") {
      try {
        parsedNotes = JSON.parse(rawNotes);
      } catch (error) {
        parsedNotes = [];
      }
    } else if (Array.isArray(rawNotes)) {
      parsedNotes = rawNotes;
    }

    if (
      !parsedNotes ||
      !Array.isArray(parsedNotes) ||
      parsedNotes.length === 0
    ) {
      parsedNotes = this._generateFallbackNotes(song);
      this.usingFallbackNotes = true;
    } else {
      const durationSeconds = Math.max(
        10,
        this._parseDuration(song.length) ||
          this._parseDuration(song.duration) ||
          this._parseDuration(song.song?.length) ||
          30
      );
      const minExpectedNotes = Math.max(12, Math.floor(durationSeconds / 1.2));
      const lastNoteTime = parsedNotes.reduce((maxTime, noteObj) => {
        const noteStart = Number(noteObj?.startTime ?? noteObj?.t ?? 0);
        return Number.isFinite(noteStart) && noteStart > maxTime
          ? noteStart
          : maxTime;
      }, 0);
      const isLikelyPlaceholder = parsedNotes.length <= minExpectedNotes * 0.2;
      const isCoverageShort = lastNoteTime < Math.max(3, durationSeconds * 0.25);

      if (isLikelyPlaceholder && isCoverageShort) {
        parsedNotes = this._generateFallbackNotes(song);
        this.usingFallbackNotes = true;
      }
    }

    const songIdText = String(song.id || song.sheetId || song.songId || "");
    const shouldNormalizeRandomChart =
      this.usingFallbackNotes || songIdText.startsWith("local-");
    if (shouldNormalizeRandomChart) {
      parsedNotes = this._normalizeRandomNotes(parsedNotes, song);
    }

    let effectiveGimmicks = Array.isArray(song?.gimmicks) ? [...song.gimmicks] : [];
    if (this.enableRandomGimmicks) {
      const randomBundle = this._generateRandomFallbackGimmicksAndShifts(
        parsedNotes,
        song,
        this.randomGimmickMode
      );
      parsedNotes = randomBundle.notes;
      effectiveGimmicks = [...effectiveGimmicks, ...randomBundle.gimmicks];
      song.gimmicks = effectiveGimmicks;
    }

    if (!this.usingFallbackNotes) {
      this.usingFallbackNotes = false;
    }

    // Bake lane-shift source X once during chart parsing to avoid runtime lookups.
    if (Array.isArray(parsedNotes) && Array.isArray(this.dropTrackArr)) {
      parsedNotes.forEach((noteObj) => {
        if (!noteObj || typeof noteObj !== "object") return;
        const shift = noteObj.shift;
        if (!shift || typeof shift !== "object") return;

        const fromLaneNum = Number(shift.fromLane);
        if (!Number.isFinite(fromLaneNum)) return;

        const fromLaneIndex = Math.trunc(fromLaneNum);
        const fromTrack = this.dropTrackArr[fromLaneIndex];
        if (!fromTrack) return;

        shift.fromX = fromTrack.x;
      });
    }

    this.gimmicks = effectiveGimmicks;
    this.bakeVisualPositions(parsedNotes, this.gimmicks);

    this.timeArr = parsedNotes;
    if (this.vm) {
      const longNoteCount = this.timeArr.reduce((count, noteObj) => {
        const start = Number(noteObj?.startTime ?? noteObj?.t ?? 0);
        const endFromObj = noteObj?.endTime;
        const len = Number(noteObj?.l ?? 0);
        const end =
          endFromObj !== undefined
            ? Number(endFromObj)
            : Number.isFinite(start) && Number.isFinite(len)
            ? start + len
            : start;
        return end > start ? count + 1 : count;
      }, 0);
      const plannedJudgementCount = this.timeArr.length + longNoteCount;
      if (typeof this.vm.setTotalNoteCount === "function") {
        this.vm.setTotalNoteCount(plannedJudgementCount);
      } else {
        this.vm.totalNoteCount = plannedJudgementCount;
      }
    }
    this.startSongAt = song.startAt ?? 0;

    if (this.audioPath) {
      if (this.vm && this.vm.instance) this.vm.instance.loading = true;
      this.loadAudio(this.audioPath).catch((err) => {
        console.error("Audio preloading failed", this.audioPath, err);
        this._handleAudioLoadError(err, this.audioPath);
      });
    } else {
      this._handleAudioLoadError(
        new Error("Missing audioPath"),
        this.audioPath
      );
    }
  }

  _parseDuration(songLength) {
    if (typeof songLength === "number" && songLength > 0) return songLength;
    if (typeof songLength === "string") {
      const parts = songLength.split(":").map((v) => Number(v.trim()));
      if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
      ) {
        return parts[0] * 60 + parts[1];
      }
      const numeric = Number(songLength);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
    }
    return 0;
  }

  _getGimmickStartTime(gimmick) {
    const t = gimmick?.time ?? gimmick?.startTime ?? gimmick?.t;
    const num = Number(t);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  }

  _getGimmickEndTime(gimmick) {
    const endRaw = gimmick?.endTime;
    const durationRaw = gimmick?.duration ?? gimmick?.d ?? gimmick?.l;
    const start = this._getGimmickStartTime(gimmick);
    const endNum = Number(endRaw);
    if (Number.isFinite(endNum) && endNum >= start) return endNum;
    const durationNum = Number(durationRaw);
    if (Number.isFinite(durationNum) && durationNum > 0) return start + durationNum;
    return start;
  }

  buildVisualTimeline(gimmicks = []) {
    const speedEvents = [];
    const stopIntervals = [];
    const points = new Set([0]);

    gimmicks.forEach((g) => {
      const type = String(g?.type || "").toLowerCase();
      if (type === "speed") {
        const at = this._getGimmickStartTime(g);
        const speedRaw = g?.value ?? g?.speed ?? g?.multiplier ?? g?.v;
        const speed = Number(speedRaw);
        speedEvents.push({ at, speed: Number.isFinite(speed) ? speed : 1.0 });
        points.add(at);
      } else if (type === "stop") {
        const start = this._getGimmickStartTime(g);
        const end = this._getGimmickEndTime(g);
        if (end > start) {
          stopIntervals.push({ start, end });
          points.add(start);
          points.add(end);
        }
      }
    });

    speedEvents.sort((a, b) => a.at - b.at);
    stopIntervals.sort((a, b) => a.start - b.start);

    const sortedPoints = Array.from(points).sort((a, b) => a - b);
    const timeline = [];
    let currentSpeed = 1.0;
    let speedIdx = 0;
    let cumulative = 0;

    for (let i = 0; i < sortedPoints.length; i += 1) {
      const t0 = sortedPoints[i];

      while (speedIdx < speedEvents.length && speedEvents[speedIdx].at <= t0) {
        currentSpeed = speedEvents[speedIdx].speed;
        speedIdx += 1;
      }

      const t1 = i + 1 < sortedPoints.length ? sortedPoints[i + 1] : null;
      if (t1 === null || t1 <= t0) continue;

      const mid = (t0 + t1) / 2;
      const stopped = stopIntervals.some((s) => mid >= s.start && mid < s.end);
      const rate = stopped ? 0 : currentSpeed;

      timeline.push({ start: t0, end: t1, rate, cumulativeAtStart: cumulative });
      cumulative += (t1 - t0) * rate;
    }

    this.visualTimeline = timeline;
    this.visualSpeedEvents = speedEvents;
    this.visualStopIntervals = stopIntervals;
    this.reverseGimmicks = [];
  }

  getVisualRateAtTime(timeSec) {
    const t = Math.max(0, Number(timeSec) || 0);
    let speed = 1.0;
    if (Array.isArray(this.visualSpeedEvents)) {
      for (let i = 0; i < this.visualSpeedEvents.length; i += 1) {
        const evt = this.visualSpeedEvents[i];
        if (evt.at <= t) {
          speed = evt.speed;
        } else {
          break;
        }
      }
    }
    const stopped = Array.isArray(this.visualStopIntervals)
      ? this.visualStopIntervals.some((s) => t >= s.start && t < s.end)
      : false;
    return stopped ? 0 : speed;
  }

  getVisualPositionAtTime(timeSec) {
    // Lead-in (negative time) scrolls at the base rate.
    if (Number(timeSec) < 0) return Number(timeSec);
    const t = Math.max(0, Number(timeSec) || 0);
    if (!this.visualTimeline || this.visualTimeline.length === 0) {
      return t;
    }

    let last = this.visualTimeline[0];
    for (let i = 0; i < this.visualTimeline.length; i += 1) {
      const seg = this.visualTimeline[i];
      if (t < seg.start) {
        return seg.cumulativeAtStart;
      }
      if (t >= seg.start && t < seg.end) {
        return seg.cumulativeAtStart + (t - seg.start) * seg.rate;
      }
      last = seg;
    }

    const cumulativeAtLastEnd =
      last.cumulativeAtStart + (last.end - last.start) * last.rate;
    const tailRate = this.getVisualRateAtTime(t);
    return cumulativeAtLastEnd + (t - last.end) * tailRate;
  }

  bakeVisualPositions(notes, gimmicks = []) {
    this.buildVisualTimeline(gimmicks);
    if (!Array.isArray(notes)) return notes;

    notes.forEach((noteObj) => {
      const startTime = Number(noteObj?.startTime ?? noteObj?.t ?? 0);
      const safeStart = Number.isFinite(startTime) ? Math.max(0, startTime) : 0;
      noteObj.visualPos = this.getVisualPositionAtTime(safeStart);
    });

    return notes;
  }

  _generateFallbackNotes(song) {
    const durationSeconds = Math.max(
      10,
      this._parseDuration(song.length) ||
        this._parseDuration(song.duration) ||
        this._parseDuration(song.song?.length) ||
        30
    );
    const bpm = Number(song.bpm || song.song?.bpm) || 120;
    const beatSec = 60 / Math.max(1, bpm);
    const notes = [];
    const endTime = Math.max(1.5, durationSeconds - 0.1);
    let t = 1.0;

    while (t <= endTime) {
      const key = Math.floor(Math.random() * 4);
      const isLong = Math.random() < 0.18;
      const maxLong = Math.max(0, endTime - t - 0.1);
      const longSec = isLong
        ? Math.min(maxLong, beatSec * (Math.random() < 0.5 ? 1 : 2))
        : 0;

      const note = { t: Number(t.toFixed(3)), key };
      if (longSec > 0.05) {
        note.l = Number(longSec.toFixed(3));
      }
      notes.push(note);

      const stepMul = Math.random() < 0.65 ? 0.5 : 1.0;
      t += beatSec * stepMul;
    }

    return notes;
  }

  _pickDifferentLane(targetLane) {
    const candidates = [0, 1, 2, 3].filter((lane) => lane !== targetLane);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  _getBaseSpeedForGimmickGeneration() {
    const fromSession = Number(this.sessionSpeedMultiplier);
    if (Number.isFinite(fromSession) && fromSession > 0) return fromSession;

    const fromStore = Number(this.vm?.$store?.state?.speedMultiplier);
    if (Number.isFinite(fromStore) && fromStore > 0) return fromStore;

    const fromVm = Number(this.vm?.noteSpeed);
    if (Number.isFinite(fromVm) && fromVm > 0) return fromVm;

    return 1.0;
  }

  _normalizeRandomGimmickMode(mode, legacyEnabled = false) {
    const normalized = String(mode || "").toLowerCase();
    const allowed = ["off", "speed", "lane", "both"];
    if (allowed.includes(normalized)) {
      return normalized;
    }
    return legacyEnabled ? "both" : "off";
  }

  _generateRandomFallbackGimmicksAndShifts(noteArr, song, mode = "both") {
    const notes = Array.isArray(noteArr)
      ? noteArr.map((note) => ({ ...note }))
      : [];

    const resolvedMode = this._normalizeRandomGimmickMode(mode, false);
    const includeSpeed = resolvedMode === "speed" || resolvedMode === "both";
    const includeLane = resolvedMode === "lane" || resolvedMode === "both";

    const durationSeconds = Math.max(
      10,
      this._parseDuration(song?.length) ||
        this._parseDuration(song?.duration) ||
        this._parseDuration(song?.song?.length) ||
        30
    );
    const endTime = Math.max(1.5, durationSeconds - 0.1);
    const generatedGimmicks = [];
    const baseSpeed = this._getBaseSpeedForGimmickGeneration();
    const effectiveMin = Math.max(0.5, baseSpeed - 1.0);
    const effectiveMax = Math.min(9.9, baseSpeed + 1.0);
    const multiplierMin = Math.max(0.25, effectiveMin / baseSpeed);
    const multiplierMax = Math.max(multiplierMin, effectiveMax / baseSpeed);

    if (includeSpeed) {
      let speedAt = 5 + Math.random() * 5;
      while (speedAt < endTime - 0.25) {
        const speedValue = Number(
          (
            multiplierMin + Math.random() * (multiplierMax - multiplierMin)
          ).toFixed(3)
        );
        generatedGimmicks.push({
          type: "speed",
          startTime: Number(speedAt.toFixed(3)),
          value: speedValue,
        });
        speedAt += 5 + Math.random() * 5;
      }
    }

    generatedGimmicks.sort(
      (a, b) => this._getGimmickStartTime(a) - this._getGimmickStartTime(b)
    );

    const singleCandidates = notes.filter((note) => {
      const start = Number(note?.startTime ?? note?.t ?? 0);
      const len = Number(note?.l ?? 0);
      const endFromObj = Number(note?.endTime);
      const end =
        Number.isFinite(endFromObj) && endFromObj > start
          ? endFromObj
          : Number.isFinite(start) && Number.isFinite(len)
          ? start + Math.max(0, len)
          : start;
      const isSingle = !(end > start + 0.001);
      return isSingle && !note.shift;
    });

    if (includeLane) {
      const ratio = 0.1 + Math.random() * 0.05;
      const shiftCount = Math.min(
        singleCandidates.length,
        Math.max(1, Math.floor(singleCandidates.length * ratio))
      );

      if (shiftCount > 0) {
        const pool = [...singleCandidates];
        for (let i = 0; i < shiftCount; i += 1) {
          const pickIndex = Math.floor(Math.random() * pool.length);
          const note = pool.splice(pickIndex, 1)[0];
          if (!note) continue;

          const targetLane = this._resolveLaneFromNote(note);
          if (targetLane === null) continue;
          const fromLane = this._pickDifferentLane(targetLane);
          if (fromLane === null) continue;

          note.shift = {
            fromLane,
            duration: 0.5,
          };
        }
      }
    }

    return {
      notes,
      gimmicks: generatedGimmicks,
    };
  }

  _resolveLaneFromNote(noteObj) {
    const keyToLane = { d: 0, f: 1, j: 2, k: 3 };
    if (typeof noteObj?.k === "string") {
      const laneFromK = keyToLane[noteObj.k.toLowerCase()];
      if (laneFromK !== undefined) return laneFromK;
    }

    const numericKey = Number(noteObj?.key);
    if (Number.isInteger(numericKey) && numericKey >= 0 && numericKey <= 3) {
      return numericKey;
    }
    return null;
  }

  _normalizeRandomNotes(noteArr, song) {
    if (!Array.isArray(noteArr) || noteArr.length === 0) return [];

    const bpm = Number(song?.bpm || song?.song?.bpm) || 120;
    const beatSec = 60 / Math.max(1, bpm);
    const minGapSec = Math.max(0.08, Math.min(0.13, beatSec * 0.32));
    const maxChordNotes = 2;
    const laneBlockedUntil = [0, 0, 0, 0];
    const chordCountByTime = {};

    const sorted = noteArr
      .map((noteObj) => {
        const lane = this._resolveLaneFromNote(noteObj);
        const start = Number(noteObj?.startTime ?? noteObj?.t);
        const len = Number(noteObj?.l ?? 0);
        const endFromObj = Number(noteObj?.endTime);
        const end =
          Number.isFinite(endFromObj) && endFromObj > start
            ? endFromObj
            : Number.isFinite(start) && Number.isFinite(len)
            ? start + Math.max(0, len)
            : start;

        return { lane, start, end };
      })
      .filter((n) => n.lane !== null && Number.isFinite(n.start))
      .sort((a, b) => a.start - b.start || a.lane - b.lane);

    const normalized = [];
    for (const note of sorted) {
      let start = Math.max(0, note.start);
      const lane = note.lane;

      if (start < laneBlockedUntil[lane]) {
        start = laneBlockedUntil[lane];
      }

      let duration = Math.max(0, note.end - note.start);
      if (duration > 0) {
        duration = Math.max(0.18, Math.min(duration, Math.max(beatSec * 2.5, 1.2)));
      }

      let bucket = start.toFixed(2);
      if ((chordCountByTime[bucket] || 0) >= maxChordNotes) {
        start += minGapSec;
        bucket = start.toFixed(2);
      }

      if ((chordCountByTime[bucket] || 0) >= maxChordNotes) {
        continue;
      }

      const end = duration > 0 ? start + duration : start;
      laneBlockedUntil[lane] = end + minGapSec;
      chordCountByTime[bucket] = (chordCountByTime[bucket] || 0) + 1;

      const normalizedNote = {
        t: Number(start.toFixed(3)),
        key: lane,
      };
      if (duration > 0) {
        normalizedNote.l = Number(duration.toFixed(3));
      }
      normalized.push(normalizedNote);
    }

    return normalized;
  }

  _handleAudioLoadError(error, audioPath) {
    this.loading = false;
    if (this.vm && this.vm.instance) this.vm.instance.loading = false;
    console.error("Audio load failed:", audioPath, error);
    if (this.vm && typeof this.vm.handleAudioLoadError === "function") {
      this.vm.handleAudioLoadError(error, audioPath);
      return;
    }
    if (this.vm && typeof this.vm.exitGame === "function") {
      this.vm.$store.state.gModal.show({
        bodyText:
          "Unable to load the song audio. Returning to the song select screen.",
        isError: true,
        showCancel: false,
        okCallback: () => this.vm.exitGame(null, "audio-load-failed"),
      });
    }
  }

  // [버그수정] 일시정지(창 포커스 이탈 포함) 시 눌려 있던 키를 모두 뗀 것으로 처리.
  // 포커스를 잃으면 keyup이 오지 않아 keyHoldingStatus가 true로 남아
  // 재개 후 그 키의 첫 입력이 무시(입력 씹힘)되고, 키 빔이 켜진 채로 남았음.
  // 잡고 있던 롱노트도 "홀드 중"으로 남아 키를 안 눌러도 콤보가 오르며 끝까지 진행됐으므로
  // 이 시점에 손을 뗀 것으로 판정한다(일반 릴리즈 판정과 동일 규칙).
  releaseHeldKeys() {
    this.keyHoldingStatus = {};
    this.dropTrackArr.forEach((track) => {
      if (track.isKeyDown || track.holdingNote) track.keyUp(track.keyBind[0]);
    });
  }

  pauseGame() {
    this.paused = true;
    this.releaseHeldKeys();
    this.leadInLastTick = null;
    if (this.howl && typeof this.howl.pause === "function") {
      this.howl.pause(this.currentHowlId || undefined);
    }
    this.pauseVideo();
  }

  async resumeGame(firstPlay = false) {
    this.paused = false;
    if (firstPlay) {
      this.seekTo(this.startSongAt);
      this.leadInRemaining =
        !this.vm || this.vm.playMode !== false ? LEAD_IN_SEC : 0;
      this.leadInLastTick = null;
    }
    this.applyConfiguredBgmVolume();

    if (Howler.ctx && Howler.ctx.state === "suspended") {
      try {
        await Howler.ctx.resume();
      } catch (e) {
        // ignore and continue playback attempt
      }
    }

    if (this.leadInRemaining > 0) return;
    this.playMedia();
  }

  playMedia() {
    if (this.howl && typeof this.howl.play === "function") {
      if (this.currentHowlId !== null && this.currentHowlId !== undefined) {
        this.currentHowlId = this.howl.play(this.currentHowlId);
      } else {
        this.currentHowlId = this.howl.play();
      }
    }
    this.playVideo();
  }
}
