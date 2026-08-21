const MISS_HEALTH_PENALTY = 9;
const RELEASE_BREAK_EARLY_MS = 175;
const RELEASE_MAX_ONE_EARLY_MS = 150;
const RELEASE_MAX_ONE_LATE_MS = 250;
const SHIFT_SPEED_MULTIPLIER = 1.8;

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
    this.noteFailed = false;
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

  getHitErrorMs() {
    return Math.abs((this.game.currentTime - this.startTime) * 1000);
  }

  judge() {
    const errorMs = this.getHitErrorMs();
    if (errorMs <= 50) return "MAX 100%";
    if (errorMs <= 100) return "MAX 90%";
    if (errorMs <= 150) return "MAX 50%";
    return "Miss";
  }

  // 🚨 노트를 안 치고 일정 시간 안에 판정선을 지나면 자동으로 실행되는 미스 처리
  missNote() {
    if (this.noteFailed) return;
    this.noteFailed = true;
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

  _getBaseJudgePercent(errorMs) {
    if (errorMs <= 41.67) return 100;
    if (errorMs <= 75.0) return 99 - ((errorMs - 41.67) / 33.33) * 9;
    if (errorMs <= 108.33) return 89 - ((errorMs - 75.0) / 33.33) * 19;
    if (errorMs <= 141.67) return 69 - ((errorMs - 108.33) / 33.33) * 59;
    if (errorMs <= 175.0) return 9 - ((errorMs - 141.67) / 33.33) * 8;
    return 0;
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
      this.vm.health = Math.min(100, this.vm.health + 5);
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
      this.completeLongHold();
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

  update() {
    if (this.game.paused) return;

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

    if (this.isLong) {
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
      const isVisible = bodyTop <= canvasHeight + 150 && this.y >= -150;
      if (isVisible) {
        const color = this.noteFailed
          ? "rgba(100, 100, 100, 0.3)"
          : isShiftNote
          ? "#3ad5ff"
          : "#ffaa00";
        this.ctx.fillStyle = color;
        this.ctx.fillRect(this.x, bodyTop, this.width, bodyHeight);
        this.ctx.fillRect(this.x, this.y, this.width, this.singleNoteHeight);
      }
    } else {
      if (this.y >= -150 && this.y <= this.game.canvas.height + 150) {
        const color = this.noteFailed
          ? "rgba(100, 100, 100, 0.3)"
          : isShiftNote
          ? "#58e6ff"
          : "#ffcc00";
        this.ctx.fillStyle = color;
        this.ctx.fillRect(this.x, this.y, this.width, this.singleNoteHeight);
      }
    }
  }
}
