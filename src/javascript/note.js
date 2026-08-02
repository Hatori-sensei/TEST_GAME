export default class Note {
  constructor(vm, game, keyObj, key, x, y = 0, width) {
    this.vm = vm;
    this.game = game;
    this.keyObj = keyObj;
    this.key = key;
    this.x = x;
    this.y = y;
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
    this._configureTiming();
  }

  _configureTiming() {
    this.startTime = this.keyObj.startTime ?? this.keyObj.t ?? 0;
    this.endTime = this.keyObj.endTime ??
      (this.keyObj.l !== undefined ? this.startTime + Number(this.keyObj.l) : undefined) ??
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
    this.vm.result.totalHitNotes += 1;
    this.vm.result.combo = 0;
    this.vm.result.feverMultiplier = 1;
    this.vm.result.feverGauge = 0;

    // 체력 20% 감소
    this.vm.health = Math.max(0, this.vm.health - 20);

    if (this.vm.$refs.judgeDisplay) {
      this.vm.$refs.judgeDisplay.judge("Miss", 0);
    }

    if (this.vm.health <= 0) {
      if (typeof this.vm.triggerGameOverImmediate === 'function') {
        this.vm.triggerGameOverImmediate();
      }
    }
  }

  beginLongHold() {
    if (!this.isLong || this.noteFailed || this.hitRegistered) return;
    this.hitRegistered = true;
    this.holding = true;
    this.lastTickTime = this.game.currentTime;
  }

  completeLongHold() {
    if (!this.isLong || this.noteFailed || this.holdCompleted) return;
    this.holding = false;
    this.holdCompleted = true;
    this.noteFailed = true;
    if (this.vm.$refs.judgeDisplay) {
      this.vm.$refs.judgeDisplay.judge("Hold OK", this.vm.result.combo);
    }
  }

  releaseLongHold() {
    if (!this.isLong || this.noteFailed || !this.hitRegistered || this.holdCompleted) return;
    if (this.game.currentTime < this.endTime - 0.05) {
      this.missNote();
    } else {
      this.completeLongHold();
    }
  }

  _applyHoldTick() {
    if (this.noteFailed || this.holdCompleted) return;
    this.vm.result.combo += 1;
    this.vm.result.maxCombo = Math.max(this.vm.result.combo, this.vm.result.maxCombo || 0);

    if (this.vm.$refs.judgeDisplay) {
      this.vm.$refs.judgeDisplay.judge("Hold Tick", this.vm.result.combo);
    }

    // 최소한의 롱노트 보상: 콤보 유지와 약간의 게이지 차지
    this.vm.result.feverGauge = (this.vm.result.feverGauge || 0) + 1;
    if (this.vm.result.feverGauge >= 100) {
      if ((this.vm.result.feverMultiplier || 1) < 5) this.vm.result.feverMultiplier++;
      this.vm.result.feverGauge -= 100;
    }
  }

  _processHoldTicks() {
    if (!this.holding || this.noteFailed || this.holdCompleted) return;

    const elapsedMs = (this.game.currentTime - this.lastTickTime) * 1000;
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
    const timeDiff = this.game.currentTime - this.startTime;
    this.y = timeDiff * speed + this.game.checkHitLineY;

    if (this.isLong) {
      if (this.holding) {
        this._processHoldTicks();

        if (this.game.currentTime > this.endTime + 0.175) {
          this.completeLongHold();
        }
      } else {
        if (!this.hitRegistered && this.game.currentTime > this.startTime + 0.175) {
          this.missNote();
        }
      }
    } else {
      const noteBottomY = this.y + this.singleNoteHeight;
      const passedPx = noteBottomY - this.game.checkHitLineY;
      const passedMs = (passedPx / speed) * 1000;

      if (!this.noteFailed && passedMs > 175) {
        this.missNote();
      }
    }

    const color = this.noteFailed ? "rgba(100, 100, 100, 0.3)" : this.isLong ? "#ffaa00" : "#ffcc00";
    this.ctx.fillStyle = color;

    if (this.isLong) {
      const bodyHeight = Math.max(0, this.duration * speed);
      const bodyTop = this.y - bodyHeight;
      this.ctx.fillRect(this.x, bodyTop, this.width, bodyHeight);
      this.ctx.fillRect(this.x, this.y, this.width, this.singleNoteHeight);
    } else {
      this.ctx.fillRect(this.x, this.y, this.width, this.singleNoteHeight);
    }
  }
}