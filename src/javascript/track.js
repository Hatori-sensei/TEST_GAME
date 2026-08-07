import Note from "./note";

// 가짜 jQuery 폴리필 (카운트다운 에러 방지)
if (typeof window.$ === "undefined") {
  window.$ = function () {
    return {
      circleProgress: function () {},
      on: function () {},
      off: function () {},
    };
  };
}
window.$.isArray = Array.isArray;
window.$.type = function (obj) {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
};

const MISS_HEALTH_PENALTY = 9;

export default class DropTrack {
  constructor(vm, game, x, width, keyBind) {
    this.vm = vm;
    this.game = game;
    this.x = x;
    this.width = width;
    this.keyBind = Array.isArray(keyBind) ? keyBind : [keyBind.toLowerCase()];
    this.noteArr = [];
    this.isKeyDown = false;
    this.isHolding = false;
    this.holdingNote = null;

    // 🚨 실제 엔진의 판정 높이를 밑에서 140px 위로 정확히 고정
    this.game.checkHitLineY = this.game.canvas.height - 320;

    this.particleEffect = new HitEffect(vm, game);

    // ... 나머지 코드 유지
  }
  // ... 나머지 코드 동일
  // ... 나머지 코드 동일

  resizeTrack(x, width) {
    this.x = x;
    this.width = width;
  }

  dropNote(key, keyObj) {
    if (this.keyBind.includes(key.toLowerCase())) {
      this.noteArr.push(
        new Note(this.vm, this.game, keyObj, key, this.x, 0, this.width)
      );
    }
  }

  _calculateJudgePercent(diffMs) {
    let rawPercent = 0;
    if (diffMs <= 41.67) rawPercent = 100;
    else if (diffMs <= 75.0) {
      rawPercent = 99 - ((diffMs - 41.67) / 33.33) * 9;
    } else if (diffMs <= 108.33) {
      rawPercent = 89 - ((diffMs - 75.0) / 33.33) * 19;
    } else if (diffMs <= 141.67) {
      rawPercent = 69 - ((diffMs - 108.33) / 33.33) * 59;
    } else {
      rawPercent = 9 - ((diffMs - 141.67) / 33.33) * 8;
    }

    return Math.max(0, Math.min(100, rawPercent));
  }

  _formatJudgeDisplayPercent(percent) {
    if (percent >= 100) return 100;
    if (percent < 10) return 1;
    return Math.floor(percent / 10) * 10;
  }

  _recordJudgement(percent, judgeText) {
    if (typeof this.vm.registerJudgePercent === "function") {
      this.vm.registerJudgePercent(percent);
    }
    if (typeof this.vm.registerJudgeLabel === "function") {
      this.vm.registerJudgeLabel(judgeText);
    }
  }

  keyDown(key) {
    if (!this.keyBind.includes(key.toLowerCase())) return;

    this.isKeyDown = true;
    const activeNoteIdx = this.noteArr.findIndex((n) => !n.noteFailed);
    if (activeNoteIdx === -1) return;

    const note = this.noteArr[activeNoteIdx];
    const noteBottomY = note.y + note.singleNoteHeight;
    const diffPx = Math.abs(this.game.checkHitLineY - noteBottomY);
    const diffMs = (diffPx / this.game.noteSpeedPxPerSec) * 1000;
    const isEarly = noteBottomY < this.game.checkHitLineY;

    const HIT_WINDOW = 175;
    const EARLY_MISS_WINDOW = 300;

    if (note.isLong) {
      if (note.hitRegistered) return;
      if (diffMs <= HIT_WINDOW) {
        const judgePercent = this._calculateJudgePercent(diffMs);
        const displayPercent = this._formatJudgeDisplayPercent(judgePercent);
        const judgeString = `MAX ${displayPercent}%`;

        this.vm.result.combo += this.vm.result.feverMultiplier || 1;
        this.vm.result.maxCombo = Math.max(
          this.vm.result.combo,
          this.vm.result.maxCombo || 0
        );
        this._recordJudgement(judgePercent, judgeString);

        let gaugeCharge = judgePercent === 100 ? 5 : judgePercent >= 90 ? 3 : 1;
        this.vm.result.feverGauge =
          (this.vm.result.feverGauge || 0) + gaugeCharge;
        if (this.vm.result.feverGauge >= 100) {
          if ((this.vm.result.feverMultiplier || 1) < 5) {
            this.vm.result.feverMultiplier++;
          }
          this.vm.result.feverGauge -= 100;
        }

        if (displayPercent === 100) {
          this.vm.result.marks.perfect += 1;
          this.vm.health = Math.min(100, this.vm.health + 10);
        } else if (displayPercent === 1) {
          this.vm.result.marks.offbeat += 1;
        } else {
          this.vm.result.marks.good += 1;
          this.vm.health = Math.min(100, this.vm.health + 5);
        }

        if (this.vm.$refs.judgeDisplay) {
          this.vm.$refs.judgeDisplay.judge(judgeString, this.vm.result.combo);
        }
        if (this.particleEffect) {
          this.particleEffect.create(
            this.x,
            this.game.checkHitLineY,
            this.width,
            judgeString
          );
        }

        note.beginLongHold(judgeString);
        this.isHolding = true;
        this.holdingNote = note;
        return;
      }

      if (isEarly && diffMs <= EARLY_MISS_WINDOW) {
        this.vm.result.combo = 0;
        this.vm.result.feverMultiplier = 1;
        this.vm.result.feverGauge = 0;
        this.vm.result.marks.miss += 1;
        this._recordJudgement(0, "BREAK");
        this.vm.health = Math.max(0, this.vm.health - MISS_HEALTH_PENALTY);
        if (this.vm.$refs.judgeDisplay) {
          this.vm.$refs.judgeDisplay.judge("BREAK", 0);
        }
        if (this.vm.health <= 0) {
          if (typeof this.vm.triggerGameOverImmediate === "function") {
            this.vm.triggerGameOverImmediate();
          } else {
            this.vm.isGameEnded = true;
            this.game.pauseGame();
          }
        }
        this.noteArr.splice(activeNoteIdx, 1);
      }

      return;
    }

    if (diffMs <= HIT_WINDOW) {
      const judgePercent = this._calculateJudgePercent(diffMs);
      const displayPercent = this._formatJudgeDisplayPercent(judgePercent);
      const judgeString = `MAX ${displayPercent}%`;

      this.vm.result.combo += this.vm.result.feverMultiplier || 1;
      this.vm.result.maxCombo = Math.max(
        this.vm.result.combo,
        this.vm.result.maxCombo || 0
      );
      this._recordJudgement(judgePercent, judgeString);

      let gaugeCharge = judgePercent === 100 ? 5 : judgePercent >= 90 ? 3 : 1;
      this.vm.result.feverGauge =
        (this.vm.result.feverGauge || 0) + gaugeCharge;
      if (this.vm.result.feverGauge >= 100) {
        if ((this.vm.result.feverMultiplier || 1) < 5) {
          this.vm.result.feverMultiplier++;
        }
        this.vm.result.feverGauge -= 100;
      }

      if (displayPercent === 100) {
        this.vm.result.marks.perfect += 1;
        this.vm.health = Math.min(100, this.vm.health + 10);
      } else if (displayPercent === 1) {
        this.vm.result.marks.offbeat += 1;
      } else {
        this.vm.result.marks.good += 1;
        this.vm.health = Math.min(100, this.vm.health + 5);
      }

      if (this.vm.$refs.judgeDisplay) {
        this.vm.$refs.judgeDisplay.judge(judgeString, this.vm.result.combo);
      }
      if (this.particleEffect) {
        this.particleEffect.create(
          this.x,
          this.game.checkHitLineY,
          this.width,
          judgeString
        );
      }
      this.noteArr.splice(activeNoteIdx, 1);
      return;
    }

    if (isEarly && diffMs <= EARLY_MISS_WINDOW) {
      this.vm.result.combo = 0;
      this.vm.result.feverMultiplier = 1;
      this.vm.result.feverGauge = 0;
      this.vm.result.marks.miss += 1;
      this._recordJudgement(0, "BREAK");
      this.vm.health = Math.max(0, this.vm.health - MISS_HEALTH_PENALTY);
      if (this.vm.$refs.judgeDisplay) {
        this.vm.$refs.judgeDisplay.judge("BREAK", 0);
      }
      if (this.vm.health <= 0) {
        if (typeof this.vm.triggerGameOverImmediate === "function") {
          this.vm.triggerGameOverImmediate();
        } else {
          this.vm.isGameEnded = true;
          this.game.pauseGame();
        }
      }
      this.noteArr.splice(activeNoteIdx, 1);
    }
  }

  // 🚨 키 빔 꺼짐을 담당하는 핵심 함수
  keyUp(key) {
    if (!this.keyBind.includes(key.toLowerCase())) return;
    this.isKeyDown = false;

    if (this.holdingNote) {
      this.holdingNote.releaseLongHold();
      this.holdingNote = null;
      this.isHolding = false;
    }
  }

  update() {
    if (this.isKeyDown) {
      let grad = this.game.ctx.createLinearGradient(
        0,
        this.game.checkHitLineY,
        0,
        0
      );
      grad.addColorStop(0, "rgba(150, 220, 255, 0.7)");
      grad.addColorStop(1, "rgba(150, 220, 255, 0)");
      this.game.ctx.fillStyle = grad;
      this.game.ctx.fillRect(this.x, 0, this.width, this.game.checkHitLineY);
    }

    for (let i = this.noteArr.length - 1; i >= 0; i--) {
      this.noteArr[i].update();
      if (this.noteArr[i].noteFailed) {
        if (this.holdingNote === this.noteArr[i]) {
          this.holdingNote = null;
          this.isHolding = false;
        }
        this.noteArr.splice(i, 1);
        continue;
      }

      const note = this.noteArr[i];
      const speed = this.game.noteSpeedPxPerSec || 1;

      if (note.isLong) {
        if (note.holding) {
          continue;
        }

        continue;
      }

      const noteBottomY = note.y + (note.height || 15);
      const passedPx = noteBottomY - this.game.checkHitLineY;
      const passedMs = (passedPx / speed) * 1000;

      // 판정 범위를 지나쳐서 떨어지면 완벽하게 놓친 것으로 처리 (Miss)
      if (passedMs > 175) {
        if (typeof note.missNote === "function") note.missNote();
        this.noteArr.splice(i, 1);
      }
    }

    if (this.particleEffect) this.particleEffect.update();
  }
}

// =================================================================
// 🚨 디맥 하드코어 "퐝!!!!" 폭발 이펙트 엔진 🚨
// =================================================================

export class HitEffect {
  constructor(vm, game) {
    this.particles = [];
    this.rings = [];
    this.flares = [];
    this.cores = [];
    this.shards = [];
    this.game = game;
  }

  create(mX, mY, mWidth, judge) {
    const x = mX + mWidth / 2;
    const y = mY;
    const color = this.getColor(judge);
    const accent = judge === "MAX 100%" ? "#7af4ff" : "#ffffff";

    this.cores.push({ x, y, radius: 8, alpha: 1, color: accent });
    this.flares.push({
      x: mX - 5,
      y: mY,
      width: mWidth + 6,
      color,
      alpha: 0.9,
      type: "vertical",
    });
    this.flares.push({
      x: x,
      y: y,
      color,
      alpha: 1,
      scale: 0.28,
      type: "horizontal",
    });
    this.rings.push({
      x,
      y,
      radius: 10,
      thickness: 22,
      color,
      alpha: 1,
      speed: 10,
    });
    this.rings.push({
      x,
      y,
      radius: 18,
      thickness: 8,
      color: accent,
      alpha: 0.9,
      speed: 14,
    });

    for (let i = 0; i < 24; i++) {
      const angle = ((Math.PI * 2) / 24) * i + Math.random() * 0.1;
      const speed = Math.random() * 10 + 8;
      this.particles.push(new ExplodingParticle(x, y, color, angle, speed));
    }

    for (let i = 0; i < 6; i++) {
      const angle = ((Math.PI * 2) / 6) * i + Math.PI / 12;
      this.shards.push({
        x,
        y,
        angle,
        speed: 2.5 + i * 0.35,
        alpha: 1,
        length: 14 + i * 1.5,
        color,
      });
    }
  }

  // HitEffect 클래스 내부
  getColor(judge) {
    if (judge === "MAX 100%") return "#00f0ff"; // 100%: 시안색 (Perfect)

    if (judge.startsWith("MAX")) {
      const percent = parseInt(judge.replace(/[^0-9]/g, ""));
      if (percent >= 80) return "#55ff00"; // 90%, 80%: 초록색
      if (percent >= 50) return "#ffff00"; // 70%, 60%, 50%: 노란색
      return "#ff003c"; // 40% 이하 (40~1): 빨간색
    }

    return "#ff003c";
  }

  update() {
    const ctx = this.game.ctx;
    ctx.save();

    ctx.globalCompositeOperation = "lighter";

    for (let i = this.cores.length - 1; i >= 0; i--) {
      let c = this.cores[i];
      ctx.globalAlpha = c.alpha;
      ctx.beginPath();
      ctx.fillStyle = c.color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = c.color;
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();

      c.radius += 4;
      c.alpha -= 0.1;
      if (c.alpha <= 0) this.cores.splice(i, 1);
    }

    for (let i = this.flares.length - 1; i >= 0; i--) {
      let f = this.flares[i];
      ctx.globalAlpha = f.alpha;

      if (f.type === "vertical") {
        const grad = ctx.createLinearGradient(0, f.y, 0, 0);
        grad.addColorStop(0, f.color);
        grad.addColorStop(0.4, "rgba(0,0,0,0.08)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(f.x, 0, f.width, f.y);
        f.alpha -= 0.14;
      } else if (f.type === "horizontal") {
        const width = Math.max(120, f.scale * 170);
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, width);
        grad.addColorStop(0, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.24, f.color);
        grad.addColorStop(0.6, "rgba(255,255,255,0.06)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(1, 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, width, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        f.scale += 1.2;
        f.alpha -= 0.15;
      }
      if (f.alpha <= 0) this.flares.splice(i, 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      let r = this.rings[i];
      ctx.globalAlpha = r.alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.thickness;
      ctx.shadowBlur = 14;
      ctx.shadowColor = r.color;

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();

      r.radius += r.speed;
      r.thickness *= 0.9;
      r.alpha -= 0.08;
      if (r.alpha <= 0) this.rings.splice(i, 1);
    }

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 16;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(
        s.x + Math.cos(s.angle) * s.length,
        s.y + Math.sin(s.angle) * s.length
      );
      ctx.stroke();

      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.alpha -= 0.04;
      s.length *= 0.96;
      if (s.alpha <= 0) this.shards.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].draw(ctx);
      if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
    }

    ctx.restore();
  }
}

class ExplodingParticle {
  constructor(x, y, color, angle, speed) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.speedX = Math.cos(angle) * speed;
    this.speedY = Math.sin(angle) * speed;
    this.alpha = 1;
    this.decay = Math.random() * 0.05 + 0.03;
  }

  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;

    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.speedX * 2.5, this.y - this.speedY * 2.5);
    ctx.stroke();

    this.x += this.speedX;
    this.y += this.speedY;

    this.speedX *= 0.88;
    this.speedY *= 0.88;

    this.alpha -= this.decay;
  }
}
