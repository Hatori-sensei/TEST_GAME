import DropTrack from "./track";
import FeverEffect from "./FeverEffect";
import { Howl, Howler } from "howler";
import { resolveMediaUrl } from "../utils/pathResolver";

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

    this.feverEff = new FeverEffect(vm, this);
    this.createTracks(4);
    this.registerInput();
    this.resumeAudioContext();
    this.destoryed = false;
    this.update();
  }

  resolveRuntimeMediaUrl(rawPath) {
    const resolved = resolveMediaUrl(rawPath);
    if (!resolved) return resolved;

    if (/^media:\/\//i.test(resolved)) {
      const stripped = resolved.replace(/^media:\/\//i, "");
      return `http://localhost:3000/${stripped.replace(/^\/+/, "")}`;
    }

    return resolved;
  }

  createTracks(trackNum) {
    this.dropTrackArr = [];
    this.trackNum = trackNum;
    this.trackKeyBind = ["d", "f", "j", "k"];
    this.setUserKeyBind();
    for (const keyBind of this.trackKeyBind) {
      this.dropTrackArr.push(new DropTrack(this.vm, this, 0, 150, keyBind));
    }
    this.reposition();
  }

  setUserKeyBind() {
    this.userKeyBind = this.trackKeyBind;
    this.reverseKeyMap = {};
  }

  getKeyName(keyEvent) {
    return keyEvent.key.toLowerCase();
  }

  async reposition() {
    this.canvas.width = this.vm.wrapper?.clientWidth || window.innerWidth;
    this.canvas.height = this.vm.wrapper?.clientHeight || window.innerHeight;
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

    const foundIdx = this.timeArr.findIndex((e) => e.t > this.currentTime);
    this.timeArrIdx = foundIdx !== -1 ? foundIdx : 0;
  }

  loadAudio(audioPath) {
    if (!audioPath) return Promise.reject(new Error("Audio path is required"));
    const resolvedAudioPath = this.resolveRuntimeMediaUrl(audioPath);
    if (this.howl && this.audioPath === resolvedAudioPath) {
      if (
        typeof this.howl.state === "function" &&
        this.howl.state() === "loaded"
      ) {
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
              this.timeArr = this._normalizeRandomNotes(
                this._generateFallbackNotes(fallbackSong),
                fallbackSong
              );
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
    return new Promise((resolve, reject) => {
      this.howl.once("load", () => resolve(this.howl));
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
      // Avoid timing/judgment-axis jumps while a song is running.
      if (this.vm && this.vm.started) return;
      this.reposition();
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

    if (!this.paused) this.updateCurrentTime();

    if (typeof this.onTick === "function") {
      this.onTick({ audioTime: this.currentTime, paused: this.paused });
    }

    if (
      this.videoElement &&
      !this.videoElement.paused &&
      typeof this.videoElement.currentTime === "number"
    ) {
      const drift = Math.abs(this.videoElement.currentTime - this.currentTime);
      if (drift >= 0.05) {
        try {
          this.videoElement.currentTime = this.currentTime;
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
  }

  drawUI() {
    const currentSpeed = (
      this.sessionSpeedMultiplier !== undefined
        ? this.sessionSpeedMultiplier
        : this.vm.noteSpeed || 1.0
    ).toFixed(1);
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "white";
    this.ctx.font = "20px Arial";
    this.ctx.fillText(
      `SPEED x${currentSpeed}`,
      (this.startX + this.endX) / 2,
      40
    );

    const currentCombo = this.vm.result?.combo ?? 0;
    if (currentCombo > 0) {
      this.ctx.fillText(
        `COMBO ${currentCombo}`,
        (this.startX + this.endX) / 2,
        70
      );
    }
  }

  drawDecoration() {
    // 배경 (블랙)

    // 🚨 노트보다 먼저 도화지에 그려지는 반투명 기어 배경
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; // 투명도는 여기서 0.3~0.5 등 입맛대로 조절!
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
    this.isReverse = this.getReverseStateAtTime(this.currentTime);
    this.playTime =
      this.currentTime +
      (typeof this.noteStartDelay === "number" ? this.noteStartDelay : 0) +
      1.0;
  }

  async startSong() {
    const preservedAudioPath = this.audioPath;
    this.resetPlaying();
    this.audioPath = preservedAudioPath;
    this.vm.started = true;
    this.songEndedNotified = false;

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
    if (this.audioPath) {
      try {
        this.loadAudio(this.audioPath).catch((err) => {
          console.error("Audio load failed:", err);
        });
      } catch (err) {
        console.error("Audio load failed:", err);
      }
    }
    this.resumeGame(true);
    // 노트 스폰 딜레이 (음악 시작 후 1초 뒤에 노트 등장)
    this.noteStartDelay = 1.0;
    this.intervalPlay = setInterval(this.gameTimingLoop.bind(this), 20);
  }

  async gameTimingLoop() {
    if (this.paused) return;

    // 노트 딜레이 적용: 음악 시작 후 1초 동안은 노트를 스폰하지 않음
    // (배속 변경 영향을 받지 않도록 절대 시간 기준으로 확인)
    if (this.noteStartDelay && this.currentTime < this.noteStartDelay) {
      return;
    }

    while (this.timeArr && this.timeArrIdx < this.timeArr.length) {
      const noteObj = this.timeArr[this.timeArrIdx];
      const noteStartTime = noteObj.startTime ?? noteObj.t;
      if (noteStartTime === undefined) {
        this.timeArrIdx++;
        continue;
      }

      if (noteStartTime > this.playTime) break;

      const fallbackKeys = ["d", "f", "j", "k"];
      let k = noteObj.k;
      if (k === undefined && noteObj.key !== undefined) {
        k = fallbackKeys[noteObj.key];
      }

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
    this.loading = false;
    this.songDurationSeconds = 0;
    this.usingFallbackNotes = false;
    this.currentHowlId = null;
    this.songEndedNotified = false;
  }

  loadSong(song) {
    this.resetPlaying();
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

    if (!this.usingFallbackNotes) {
      this.usingFallbackNotes = false;
    }

    const gimmicks = Array.isArray(song?.gimmicks) ? song.gimmicks : [];
    this.gimmicks = gimmicks;
    this.bakeVisualPositions(parsedNotes, gimmicks);

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
    this.reverseGimmicks = gimmicks
      .filter((g) => String(g?.type || "").toLowerCase() === "reverse")
      .sort((a, b) => this._getGimmickStartTime(a) - this._getGimmickStartTime(b));
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

  getReverseStateAtTime(timeSec) {
    const t = Math.max(0, Number(timeSec) || 0);
    if (!this.reverseGimmicks || this.reverseGimmicks.length === 0) {
      return false;
    }

    let active = false;
    for (const gimmick of this.reverseGimmicks) {
      const start = this._getGimmickStartTime(gimmick);
      const end = this._getGimmickEndTime(gimmick);
      const hasRange = end > start;
      const flag = gimmick?.enabled ?? gimmick?.on ?? gimmick?.value ?? true;
      const enabled = Boolean(flag);

      if (hasRange) {
        if (t >= start && t < end) {
          active = enabled;
        }
      } else if (t >= start) {
        active = enabled;
      }
    }

    return active;
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

  pauseGame() {
    this.paused = true;
    if (this.howl && typeof this.howl.pause === "function") {
      this.howl.pause(this.currentHowlId || undefined);
    }
    this.pauseVideo();
  }

  async resumeGame(firstPlay = false) {
    this.paused = false;
    if (firstPlay) this.seekTo(this.startSongAt);

    if (Howler.ctx && Howler.ctx.state === "suspended") {
      try {
        await Howler.ctx.resume();
      } catch (e) {
        // ignore and continue playback attempt
      }
    }

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
