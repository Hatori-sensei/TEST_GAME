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

  // 🚨 노트를 안 치고 0.15초가 지나면 자동으로 실행되는 미스 파괴 공작!
  missNote() {
    if (this.noteFailed) return;
    this.noteFailed = true;
    this.vm.result.marks.miss += 1;
    this.vm.result.totalHitNotes += 1;
    this.vm.result.combo = 0; // 콤보 즉시 0으로 초기화
    
    // 화면 중앙에 빨간색 Miss 띄우기
    if (this.vm.$refs.judgeDisplay) {
      this.vm.$refs.judgeDisplay.judge("Miss", 0);
    }
  }

  update() {
    if (this.game.paused) return;

    // 실제 음악 시간과 동기화하여 Y좌표 계산
    const timeDiff = this.game.currentTime - this.keyObj.t; 
    this.y = (timeDiff * this.game.noteSpeedPxPerSec) + this.game.checkHitLineY;

    // 🚨 핵심: 판정선을 지나고 0.15초(150ms)가 넘어가면 얄짤없이 강제 미스!
    if (!this.noteFailed && timeDiff > 0.15) {
      this.missNote();
    }

    // 미스난 노트는 반투명한 회색으로, 멀쩡한 노트는 노란색으로 그리기
    const color = this.noteFailed ? "rgba(100, 100, 100, 0.3)" : "#ffcc00";
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.x, this.y, this.width, this.singleNoteHeight);
  }
}