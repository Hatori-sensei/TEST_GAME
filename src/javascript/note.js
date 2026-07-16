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
  }

  getHitErrorMs() {
    return Math.abs((this.game.currentTime - this.keyObj.t) * 1000);
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

  update() {
    if (this.game.paused) return;

    const timeDiff = this.game.currentTime - this.keyObj.t;
    this.y = timeDiff * this.game.noteSpeedPxPerSec + this.game.checkHitLineY;

    const noteBottomY = this.y + (this.height || this.singleNoteHeight);
    const passedPx = noteBottomY - this.game.checkHitLineY;
    const passedMs = (passedPx / this.game.noteSpeedPxPerSec) * 1000;

    if (!this.noteFailed && passedMs > 175) {
      this.missNote();
    }

    // 미스난 노트는 반투명한 회색으로, 멀쩡한 노트는 노란색으로 그리기
    const color = this.noteFailed ? "rgba(100, 100, 100, 0.3)" : "#ffcc00";
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.x, this.y, this.width, this.singleNoteHeight);
  }
}