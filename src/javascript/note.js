const MISS_HEALTH_PENALTY = 9;
const RELEASE_BREAK_EARLY_MS = 175;
const RELEASE_MAX_ONE_EARLY_MS = 150;
const RELEASE_MAX_ONE_LATE_MS = 250;
const SHIFT_SPEED_MULTIPLIER = 1.8;
const NOTE_INSET_PX = 4;

// Outer lanes ice-white, inner lanes cyan, gimmick (shift) notes amber.
const NOTE_PALETTES = {
  outer: { main: "#dcefff", light: "#ffffff", dark: "#6f93b0" },
  inner: { main: "#19d3ff", light: "#c4f5ff", dark: "#0a7fa6" },
  shift: { main: "#ffb400", light: "#ffe6a0", dark: "#9a6400" },
  missed: {
    main: "rgba(200, 205, 212, 0.5)",
    light: "rgba(232, 236, 240, 0.6)",
    dark: "rgba(150, 156, 164, 0.45)",
  },
  failedSingle: {
    main: "rgba(100, 100, 100, 0.3)",
    light: "rgba(120, 120, 120, 0.3)",
    dark: "rgba(80, 80, 80, 0.3)",
  },
};

export default class Note {
  constructor(vm, game, keyObj, key, x, y = 0, width) {
    this.vm = vm;
    this.game = game;
    this.keyObj =
      keyObj && typeof keyObj === "object"
        ? {
            ...keyObj,
            shift:
              keyObj.shift && typeof keyObj.shift === "object"
                ? { ...keyObj.shift }
                : keyObj.shift,
          }
        : {};
    this.key = key;
    this.baseX = x;
    this.x = x;
    this.y = y;
    this.judgeY = y;
    this.width = width;
    this.ctx = vm.ctx;
    // noteFailed only means "done, remove me from the track's array" — it is set
    // both on a real miss and on a normal long-note release. `missed` is the
    // actual pass/fail signal; check that, not noteFailed, to tell if this note
    // was actually missed.
    this.noteFailed = false;
    this.missed = false;
    this.singleNoteHeight = 30; // 큼직한 노트 크기 유지
    this.isLong = false;
    this.startTime = 0;
    this.endTime = 0;
    this.duration = 0;
    this.holding = false;
    this.hitRegistered = false;
    this.holdCompleted = false;
    this.lastTickTime = null;
    this.tickIntervalMs = 100; // 롱노트 유지 보상 간격
    this.initialJudgeString = null;
    this.visualPos = Number(this.keyObj?.visualPos ?? 0) || 0;
    this.shiftFromX = null;

    // Resolve shift source once per note instance without mutating source chart data.
    if (this.keyObj?.shift && typeof this.keyObj.shift === "object") {
      const shift = this.keyObj.shift;
      const fromXNum = Number(shift.fromX);
      if (!Number.isFinite(fromXNum)) {
        const fromLaneNum = Number(shift.fromLane);
        if (Number.isFinite(fromLaneNum)) {
          const fromLaneIndex = Math.trunc(fromLaneNum);
          const fromTrack = this.game?.dropTrackArr?.[fromLaneIndex];
          if (fromTrack && Number.isFinite(Number(fromTrack.x))) {
            this.shiftFromX = Number(fromTrack.x);
          }
        }
      } else {
        this.shiftFromX = fromXNum;
      }
    }

    this._configureTiming();
  }

  _configureTiming() {
    this.startTime = this.keyObj.startTime ?? this.keyObj.t ?? 0;
    this.endTime =
      this.keyObj.endTime ??
      (this.keyObj.l !== undefined
        ? this.startTime + Number(this.keyObj.l)
        : undefined) ??
      this.startTime;
    this.duration = Math.max(0, this.endTime - this.startTime);
    this.type = this.keyObj.type || (this.duration > 0 ? "long" : "single");
    this.isLong = this.type === "long";
  }

  // 🚨 노트를 안 치고 일정 시간 안에 판정선을 지나면 자동으로 실행되는 미스 처리
  missNote() {
    if (this.noteFailed || this.missed) return;
    // Long notes stay on screen (grey) and scroll off; single notes are removed.
    if (this.isLong) {
      this.holdCompleted = true;
    } else {
      this.noteFailed = true;
    }
    this.missed = true;
    this.vm.result.marks.miss += 1;
    if (typeof this.vm.registerJudgePercent === "function") {
      this.vm.registerJudgePercent(0);
    }
    if (typeof this.vm.registerJudgeLabel === "function") {
      this.vm.registerJudgeLabel("BREAK");
    }
    this.vm.result.combo = 0;
    this.vm.result.feverMultiplier = 1;
    this.vm.result.feverGauge = 0;

    // 미스 체력 감소량 조정: 약 10~12회 미스 시 게임오버
    this.vm.health = Math.max(0, this.vm.health - MISS_HEALTH_PENALTY);

    if (this.vm.$refs.judgeDisplay) {
      this.vm.$refs.judgeDisplay.judge("BREAK", 0);
    }

    if (this.vm.health <= 0) {
      if (typeof this.vm.triggerGameOverImmediate === "function") {
        this.vm.triggerGameOverImmediate();
      }
    }
  }

  beginLongHold(initialJudgeString) {
    if (!this.isLong || this.noteFailed || this.hitRegistered) return;
    this.hitRegistered = true;
    this.holding = true;
    this.lastTickTime = this.game.currentTime;
    if (initialJudgeString) {
      this.initialJudgeString = initialJudgeString;
      if (this.vm.$refs.judgeDisplay) {
        this.vm.$refs.judgeDisplay.markJudge = initialJudgeString;
        this.vm.$refs.judgeDisplay.combo = this.vm.result.combo;
        this.vm.$refs.judgeDisplay.showAll = true;
        this.vm.$refs.judgeDisplay.display = true;
        clearTimeout(this.vm.$refs.judgeDisplay.timeout);
      }
    }
  }

  completeLongHold() {
    if (!this.isLong || this.noteFailed || this.holdCompleted) return;
    this.holding = false;
    this.holdCompleted = true;
    this.noteFailed = true;
  }

  _applyLongReleaseJudge(judgeText, judgePercent) {
    if (typeof this.vm.registerJudgePercent === "function") {
      this.vm.registerJudgePercent(judgePercent);
    }
    if (typeof this.vm.registerJudgeLabel === "function") {
      this.vm.registerJudgeLabel(judgeText);
    }

    if (judgeText === "MAX 100%") {
      this.vm.result.marks.perfect += 1;
      this.vm.health = Math.min(100, this.vm.health + 3);
      const multiplier = this.vm.result.feverMultiplier || 1;
      this.vm.result.combo += multiplier;
      this.vm.result.maxCombo = Math.max(
        this.vm.result.combo,
        this.vm.result.maxCombo || 0
      );
    } else if (judgeText === "MAX 1%") {
      this.vm.result.marks.offbeat += 1;
      const multiplier = this.vm.result.feverMultiplier || 1;
      this.vm.result.combo += multiplier;
      this.vm.result.maxCombo = Math.max(
        this.vm.result.combo,
        this.vm.result.maxCombo || 0
      );
    } else {
      this.missed = true;
      this.vm.result.marks.miss += 1;
      this.vm.result.combo = 0;
      this.vm.result.feverMultiplier = 1;
      this.vm.result.feverGauge = 0;
      this.vm.health = Math.max(0, this.vm.health - MISS_HEALTH_PENALTY);
      if (this.vm.health <= 0 && typeof this.vm.triggerGameOverImmediate === "function") {
        this.vm.triggerGameOverImmediate();
      }
    }

    if (this.vm.$refs.judgeDisplay) {
      this.vm.$refs.judgeDisplay.judge(judgeText, this.vm.result.combo);
    }
  }

  releaseLongHold() {
    if (
      !this.isLong ||
      this.noteFailed ||
      !this.hitRegistered ||
      this.holdCompleted
    ) {
      return;
    }

    const releaseDeltaMs = (this.game.currentTime - this.endTime) * 1000;
    const absReleaseMs = Math.abs(releaseDeltaMs);

    // 너무 빨리 떼면 BREAK
    if (releaseDeltaMs < -RELEASE_BREAK_EARLY_MS) {
      this._applyLongReleaseJudge("BREAK", 0);
      // Keep the note alive (grey) so it scrolls off instead of vanishing.
      this.holding = false;
      this.holdCompleted = true;
      return;
    }

    // 너무 오래 늦게 떼면 MAX 1%
    if (releaseDeltaMs > RELEASE_MAX_ONE_LATE_MS) {
      this._applyLongReleaseJudge("MAX 1%", 1);
      this.completeLongHold();
      return;
    }

    if (releaseDeltaMs < 0 && absReleaseMs >= RELEASE_MAX_ONE_EARLY_MS) {
      this._applyLongReleaseJudge("MAX 1%", 1);
    } else {
      this._applyLongReleaseJudge("MAX 100%", 100);
    }

    this.completeLongHold();
  }

  _applyHoldTick() {
    if (this.noteFailed || this.holdCompleted) return;
    const multiplier = this.vm.result.feverMultiplier || 1;
    this.vm.result.combo += multiplier;
    this.vm.result.maxCombo = Math.max(
      this.vm.result.combo,
      this.vm.result.maxCombo || 0
    );

    if (this.vm.$refs.judgeDisplay && this.initialJudgeString) {
      this.vm.$refs.judgeDisplay.combo = this.vm.result.combo;
      this.vm.$refs.judgeDisplay.markJudge = this.initialJudgeString;
      this.vm.$refs.judgeDisplay.showAll = true;
      this.vm.$refs.judgeDisplay.display = true;
      clearTimeout(this.vm.$refs.judgeDisplay.timeout);
    }

    this.vm.result.feverGauge = (this.vm.result.feverGauge || 0) + 1;
    if (this.vm.result.feverGauge >= 100) {
      if ((this.vm.result.feverMultiplier || 1) < 5) {
        this.vm.result.feverMultiplier++;
      }
      this.vm.result.feverGauge -= 100;
    }
  }

  _processHoldTicks() {
    if (!this.holding || this.noteFailed || this.holdCompleted) return;

    const effectiveTime = Math.min(this.game.currentTime, this.endTime);
    const elapsedMs = (effectiveTime - this.lastTickTime) * 1000;
    if (elapsedMs >= this.tickIntervalMs) {
      const tickCount = Math.floor(elapsedMs / this.tickIntervalMs);
      this.lastTickTime += (tickCount * this.tickIntervalMs) / 1000;
      for (let i = 0; i < tickCount; i += 1) {
        this._applyHoldTick();
      }
    }
  }

  _getPalette(isShiftNote, isFailed) {
    if (this.missed) return NOTE_PALETTES.missed;
    if (isFailed) return NOTE_PALETTES.failedSingle;
    if (isShiftNote) return NOTE_PALETTES.shift;
    // [버그수정] 예전엔 키 이름("d"/"k")으로 바깥 레인을 판별해서, 키 배치를 바꾸면
    // (예: d→s) 바깥 레인 노트도 안쪽 색(청록)으로 그려졌음 → 실제 레인 위치로 판별.
    if (this.isOuterLane === undefined) {
      const binds = this.game.trackKeyBind || ["d", "f", "j", "k"];
      const lane = binds.indexOf(this.key);
      this.isOuterLane = lane === 0 || lane === binds.length - 1;
    }
    return this.isOuterLane ? NOTE_PALETTES.outer : NOTE_PALETTES.inner;
  }

  _drawNoteHead(pal, yTop = this.y) {
    const ctx = this.ctx;
    const x = this.x + NOTE_INSET_PX;
    const w = this.width - NOTE_INSET_PX * 2;
    const y = yTop;
    const h = this.singleNoteHeight;
    ctx.fillStyle = pal.main;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = pal.light;
    ctx.fillRect(x, y, w, 5);
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(x, y + 5, 2, h - 8);
    ctx.fillRect(x + w - 2, y + 5, 2, h - 8);
  }

  _drawLongBody(pal, bodyTop, bodyHeight) {
    const ctx = this.ctx;
    const x = this.x + NOTE_INSET_PX;
    const w = this.width - NOTE_INSET_PX * 2;
    ctx.fillStyle = pal.main;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x, bodyTop, w, bodyHeight);
    ctx.globalAlpha = 1;
    ctx.fillRect(x, bodyTop, 3, bodyHeight);
    ctx.fillRect(x + w - 3, bodyTop, 3, bodyHeight);
  }

  update() {
    // [개선] 예전엔 일시정지 중 여기서 바로 return해서 노트가 그려지지 않았음 → 일시정지/재개
    // 카운트다운 동안 노트가 전부 사라졌다가 재개 순간 판정선 근처에 갑자기 나타났음.
    // 일시정지 중에도 (멈춘 위치 그대로) 그리기는 하고, 판정/미스/홀드 처리만 건너뛴다.
    const paused = !!this.game.paused;

    const speed = this.game.noteSpeedPxPerSec || 1;
    const distance = this.visualPos - (this.game.currentGlobalVisualPos || 0);
    const baseY = this.game.checkHitLineY - distance * speed;
    this.judgeY = baseY;

    const reverseBlend = Number(this.game.reverseBlend) || 0;
    if (reverseBlend > 0) {
      const mirroredY = this.game.canvas.height - baseY;
      this.y = baseY + (mirroredY - baseY) * reverseBlend;
    } else {
      this.y = baseY;
    }

    const shift = !this.isLong && this.keyObj && this.keyObj.shift;
    const isShiftNote = !!(shift && typeof shift === "object");
    if (shift && typeof shift === "object") {
      const fromXNum = Number(this.shiftFromX);
      const durationNum = Number(shift.duration);
      const topEntryTravelSec =
        (this.game.checkHitLineY + 150) / Math.max(speed, 1e-6);
      const spawnLeadSecRaw = Number(this.game.noteSpawnLeadSec);
      const spawnLeadSec =
        Number.isFinite(spawnLeadSecRaw) && spawnLeadSecRaw > 0
          ? spawnLeadSecRaw
          : Number.isFinite(Number(this.game.getNoteSpawnLeadSec?.()))
          ? Number(this.game.getNoteSpawnLeadSec())
          : Number.isFinite(Number(this.game.noteDelay)) && Number(this.game.noteDelay) > 0
          ? Number(this.game.noteDelay)
          : 1.0;
      const topEntryStart = this.startTime - topEntryTravelSec;
      const spawnAlignedStart = this.startTime - Math.max(0.05, spawnLeadSec * 0.85);
      const defaultStart = Math.max(topEntryStart, spawnAlignedStart);
      const startNumRaw = shift.startTime;
      const startTime =
        Number.isFinite(Number(startNumRaw)) ? Number(startNumRaw) : defaultStart;
      const effectiveDuration =
        Number.isFinite(durationNum) && durationNum > 0
          ? Math.max(0.1, durationNum / SHIFT_SPEED_MULTIPLIER)
          : 0;

      if (Number.isFinite(fromXNum) && effectiveDuration > 0) {
        const progress = Math.min(
          1,
          Math.max(0, (this.game.currentTime - startTime) / effectiveDuration)
        );
        this.x = fromXNum + (this.baseX - fromXNum) * progress;
      } else {
        this.x = this.baseX;
      }
    } else {
      this.x = this.baseX;
    }

    if (paused) {
      // 판정/미스/홀드 틱 처리 생략(위치는 currentTime이 멈춰 있으므로 그대로)
    } else if (this.isLong) {
      if (this.holding) {
        this._processHoldTicks();

        if (
          this.game.currentTime >=
          this.endTime + RELEASE_MAX_ONE_LATE_MS / 1000
        ) {
          // 끝까지 누르고 떼지 못했을 경우: MAX 1%
          this._applyLongReleaseJudge("MAX 1%", 1);
          this.completeLongHold();
        }
      } else {
        if (
          !this.hitRegistered &&
          this.game.currentTime > this.startTime + 0.175
        ) {
          this.missNote();
        }
      }
    } else {
      const judgeReferenceY = this.judgeY + this.singleNoteHeight;
      const passedPx = judgeReferenceY - this.game.checkHitLineY;
      const passedMs = (passedPx / speed) * 1000;

      if (!this.noteFailed && passedMs > 175) {
        this.missNote();
      }
    }

    if (this.isLong) {
      const bodyHeight = Math.max(0, this.duration * speed);
      const bodyTop = this.y - bodyHeight;
      const canvasHeight = this.game.canvas.height;
      if (this.missed && this.holdCompleted && bodyTop > canvasHeight + 150) {
        this.noteFailed = true;
      }
      const isVisible = bodyTop <= canvasHeight + 150 && this.y >= -150;
      if (isVisible) {
        const pal = this._getPalette(isShiftNote, false);
        this._drawLongBody(pal, bodyTop, bodyHeight);
        // Release marker: a second note block at the tail. Its bottom edge reaches
        // the judgment line exactly at endTime, i.e. when the key should be let go.
        this._drawNoteHead(pal, bodyTop);
        this._drawNoteHead(pal);
      }
    } else {
      if (this.y >= -150 && this.y <= this.game.canvas.height + 150) {
        this._drawNoteHead(this._getPalette(isShiftNote, this.noteFailed));
      }
    }
  }
}
