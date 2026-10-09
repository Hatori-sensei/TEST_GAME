import Note from "./note";

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
  }

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

  // [설정/UI] FAST/SLOW 표시값. MAX 100%가 아닐 때만 빠름/느림을 알려줌(판정 계산과 무관, 표시만).
  _fastSlow(displayPercent, isEarly) {
    if (this.vm.showFastSlow !== true || displayPercent >= 100) return null;
    return isEarly ? "fast" : "slow";
  }

  _recordTiming(signedMs, displayPercent) {
    if (typeof this.vm.registerTiming === "function") {
      this.vm.registerTiming(signedMs, displayPercent);
    }
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
    const activeNoteIdx = this.noteArr.findIndex(
      (n) => !n.noteFailed && !n.holdCompleted
    );
    if (activeNoteIdx === -1) return;

    const note = this.noteArr[activeNoteIdx];
    const judgeBaseY = Number.isFinite(Number(note.judgeY)) ? note.judgeY : note.y;
    // [판정 기준 변경] 노트 아래 끝(+30px) → 채보 시간 기준점(judgeY). 판정 범위 수치는 그대로
    const judgeReferenceY = judgeBaseY;
    const diffPx = Math.abs(this.game.checkHitLineY - judgeReferenceY);
    const diffMs = (diffPx / this.game.noteSpeedPxPerSec) * 1000;
    const isEarly = judgeReferenceY < this.game.checkHitLineY;
    // [UI] 결과 화면 타이밍 통계용 부호 있는 오차(ms, +면 늦음). 판정에는 사용하지 않음
    const signedMs = isEarly ? -diffMs : diffMs;

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
        this._recordTiming(signedMs, displayPercent);

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
          this.vm.health = Math.min(100, this.vm.health + 4);
        } else if (displayPercent === 1) {
          this.vm.result.marks.offbeat += 1;
        } else {
          this.vm.result.marks.good += 1;
          this.vm.health = Math.min(100, this.vm.health + 3);
        }

        if (this.vm.$refs.judgeDisplay) {
          this.vm.$refs.judgeDisplay.judge(
            judgeString,
            this.vm.result.combo,
            this._fastSlow(displayPercent, isEarly)
          );
        }
        if (this.particleEffect && this.vm.noteEffectEnabled !== false) {
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
        this.holdFxAt = this.game.currentTime; // [이펙트] 첫 타격 이펙트 직후부터 HOLD_FX_INTERVAL_SEC 간격으로 반복
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
        // Pressed too early: keep the long note as a grey, already-judged note.
        note.missed = true;
        note.holdCompleted = true;
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
      this._recordTiming(signedMs, displayPercent);

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
        this.vm.health = Math.min(100, this.vm.health + 3);
      } else if (displayPercent === 1) {
        this.vm.result.marks.offbeat += 1;
      } else {
        this.vm.result.marks.good += 1;
        this.vm.health = Math.min(100, this.vm.health + 2);
      }

      if (this.vm.$refs.judgeDisplay) {
        this.vm.$refs.judgeDisplay.judge(
          judgeString,
          this.vm.result.combo,
          this._fastSlow(displayPercent, isEarly)
        );
      }
      if (this.particleEffect && this.vm.noteEffectEnabled !== false) {
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
    if (this.isKeyDown && this.vm.keyBeamEnabled !== false) {
      let grad = this.game.ctx.createLinearGradient(
        0,
        this.game.checkHitLineY,
        0,
        0
      );
      // [테마] 키 빔 색(테마1 = rgba(150, 220, 255, 0.7 → 0))
      grad.addColorStop(0, this.game.theme.beamFrom);
      grad.addColorStop(1, this.game.theme.beamTo);
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

      const judgeBaseY = Number.isFinite(Number(note.judgeY)) ? note.judgeY : note.y;
      // [판정 기준 변경] 미스 판정도 같은 채보 시간 기준점 사용
      const judgeReferenceY = judgeBaseY;
      const passedPx = judgeReferenceY - this.game.checkHitLineY;
      const passedMs = (passedPx / speed) * 1000;

      // 판정 범위를 지나쳐서 떨어지면 완벽하게 놓친 것으로 처리 (Miss)
      if (passedMs > 175) {
        if (typeof note.missNote === "function") note.missNote();
        this.noteArr.splice(i, 1);
      }
    }

    // [이펙트] 롱노트를 누르고 있는 동안 계속 터짐(게임 시간 기준이라 일시정지 중엔 멈춤, 판정과 무관)
    const held = this.holdingNote;
    if (held && held.holding && this.isKeyDown && this.particleEffect && this.vm.noteEffectEnabled !== false) {
      const t = this.game.currentTime;
      if (this.holdFxAt == null || t < this.holdFxAt) this.holdFxAt = t; // 시간이 되감기면(재시작) 기준 재설정
      if (t - this.holdFxAt >= HOLD_FX_INTERVAL_SEC) {
        this.holdFxAt = t;
        this.particleEffect.create(this.x, this.game.checkHitLineY, this.width, held.initialJudgeString || "MAX 100%");
      }
    }

    if (this.particleEffect) this.particleEffect.update();
  }
}

// =================================================================
// 🚨 타격 이펙트(퐝!) 🚨
// 최대 지름 = 레인 폭(= 노트 한 줄 폭) x FX_SCALE. 어떤 요소도 반지름 R을 넘지 않는다.
// 구성: 코어(흰색 + 3겹 후광) + 메인 링(이중 선) + 서브 링 + 스파크. 롱노트를 누르는 동안엔 HOLD_FX_INTERVAL_SEC마다 반복.
// 판정선(DOM, 흰색 띠)에 가려지지 않도록 판정선 위에 쌓인 전용 캔버스(effectCanvas)에 그림.
// 조정은 아래 상수만 바꾸면 됨.
// =================================================================
const FX_SCALE = 1.0; // 1.0 = 최대 지름이 레인 폭. 더 크게 보고 싶으면 1.2~1.5(레인 밖으로 나감)
const FX_DURATION_MS = 320; // 이펙트 한 번이 지속되는 시간
const FX_SPARK_COUNT = 10; // 스파크(방사형 짧은 선) 개수
const FX_POOL_SIZE = 32; // 동시에 존재할 수 있는 이펙트 수(풀 재사용, 가득 차면 가장 오래된 것부터 덮어씀)
const FX_CENTER_OFFSET_Y = 9; // 판정선(높이 18px) 중앙. 정타 시 노트 중앙이 여기 옴
const FX_RING_MAX_WIDTH = 16; // 메인 링 시작 굵기(px)
const FX_HOLD_UNTIL = 0.4; // 진행도가 이 값에 도달할 때까지는 최대 밝기 유지, 이후 사라짐
const HOLD_FX_INTERVAL_SEC = 0.1; // 롱노트 누르는 동안 이펙트 반복 간격(노트 틱 간격과 동일)

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

export class HitEffect {
  constructor(vm, game) {
    this.game = game;
    // 고정 크기 풀: 타격마다 새 객체를 만들지 않고 재사용
    this.pool = [];
    for (let i = 0; i < FX_POOL_SIZE; i += 1) {
      this.pool.push({ active: false, x: 0, y: 0, r: 0, color: "#fff", accent: "#fff", t0: 0, spin: 0 });
    }
    this.next = 0;
    this.count = 0; // 지금 활성 이펙트 수(0이면 update에서 바로 반환)
  }

  create(mX, mY, mWidth, judge) {
    const e = this.pool[this.next];
    this.next = (this.next + 1) % FX_POOL_SIZE;
    if (!e.active) this.count += 1;
    e.active = true;
    e.x = mX + mWidth / 2;
    e.y = mY - FX_CENTER_OFFSET_Y;
    e.r = (mWidth / 2) * FX_SCALE; // 최대 반지름 = 레인 폭의 절반
    e.color = this.getColor(judge);
    e.accent = judge === "MAX 100%" ? "#7af4ff" : "#ffffff";
    e.t0 = performance.now();
    e.spin = (this.next * 0.37) % (Math.PI / FX_SPARK_COUNT); // 연속으로 터질 때 스파크 각도가 매번 조금씩 달라지게
  }

  // 판정별 색(테마와 무관하게 고정)
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
    if (this.count === 0) return; // 활성 이펙트가 없으면 save/restore도 생략
    // 판정선(DOM) 위에 쌓인 전용 캔버스. 없으면(에디터 등) 메인 캔버스로
    const ctx = this.game.effectCtx || this.game.ctx;
    const now = performance.now();
    ctx.save();
    // 겹치는 부분이 밝아지는 빛 번짐 느낌. shadowBlur는 소프트웨어 렌더링에서 FPS를 크게 깎아서 쓰지 않음
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (let i = 0; i < FX_POOL_SIZE; i += 1) {
      const e = this.pool[i];
      if (!e.active) continue;
      // 경과 시간 기준 진행도(프레임 수와 무관 → 저FPS에서도 같은 시간에 끝남)
      const p = (now - e.t0) / FX_DURATION_MS;
      if (p >= 1) {
        e.active = false;
        this.count -= 1;
        continue;
      }
      const R = e.r;
      const ease = easeOutCubic(p);
      // 앞부분은 최대 밝기를 유지하다가 뒤에서 사라짐(눈에 오래 남도록)
      const tail = Math.max(0, (p - FX_HOLD_UNTIL) / (1 - FX_HOLD_UNTIL));
      const bright = 1 - tail * tail;
      const shrink = Math.pow(1 - p, 0.6); // 굵기는 완만하게 줄어듦

      // 1) 코어: 판정 색 후광 3겹 + 흰색 중심(shadowBlur 없이 빛 번짐 표현)
      const coreGrow = 0.75 + 0.25 * ease;
      ctx.fillStyle = e.color;
      ctx.globalAlpha = bright * 0.25;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * 0.9 * coreGrow, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = bright * 0.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * 0.6 * coreGrow, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.accent;
      ctx.globalAlpha = bright * 0.9 * (1 - p);
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * 0.35 * coreGrow, 0, Math.PI * 2);
      ctx.fill();

      // 2) 메인 링(이중 선): 넓고 옅은 바깥 선 + 좁고 밝은 안쪽 선. 바깥 가장자리가 R을 넘지 않게 보정
      const mainWidth = Math.max(2, FX_RING_MAX_WIDTH * shrink);
      const mainR = Math.max(1, Math.min(R * (0.25 + 0.75 * ease), R - mainWidth / 2));
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = bright * 0.45;
      ctx.lineWidth = mainWidth;
      ctx.beginPath();
      ctx.arc(e.x, e.y, mainR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = bright;
      ctx.lineWidth = Math.max(1.5, mainWidth * 0.45);
      ctx.beginPath();
      ctx.arc(e.x, e.y, mainR, 0, Math.PI * 2);
      ctx.stroke();

      // 3) 서브 링: 더 빠르고 밝게(0.8R까지)
      const subP = Math.min(1, p * 1.5);
      ctx.strokeStyle = e.accent;
      ctx.globalAlpha = 1 - subP * subP;
      ctx.lineWidth = Math.max(1.5, 5 * (1 - subP));
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * (0.15 + 0.65 * easeOutCubic(subP)), 0, Math.PI * 2);
      ctx.stroke();

      // 4) 스파크: 중심에서 바깥으로 날아가는 굵은 선(바깥 끝은 R 이내)
      ctx.strokeStyle = e.accent;
      ctx.globalAlpha = bright;
      ctx.lineWidth = Math.max(1.5, 4 * shrink);
      const inner = R * (0.3 + 0.4 * ease);
      const outer = Math.min(R, R * (0.55 + 0.45 * ease));
      ctx.beginPath();
      for (let k = 0; k < FX_SPARK_COUNT; k += 1) {
        const a = e.spin + (k * Math.PI * 2) / FX_SPARK_COUNT;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        ctx.moveTo(e.x + cos * inner, e.y + sin * inner);
        ctx.lineTo(e.x + cos * outer, e.y + sin * outer);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
