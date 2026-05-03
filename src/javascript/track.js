import Note from "./note";

// 가짜 jQuery 폴리필 (카운트다운 에러 방지)
if (typeof window.$ === 'undefined') {
  window.$ = function() { return { circleProgress: function() {}, on: function() {}, off: function() {} }; };
}
window.$.isArray = Array.isArray;
window.$.type = function(obj) { return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase(); };

export default class DropTrack {
  constructor(vm, game, x, width, keyBind) {
    this.vm = vm;
    this.game = game;
    this.x = x;
    this.width = width;
    this.keyBind = Array.isArray(keyBind) ? keyBind : [keyBind.toLowerCase()];
    this.noteArr = [];
    this.isKeyDown = false;
    this.particleEffect = new HitEffect(vm);
  }

  resizeTrack(x, width) { this.x = x; this.width = width; }

  dropNote(key, keyObj) {
    if (this.keyBind.includes(key.toLowerCase())) {
      this.noteArr.push(new Note(this.vm, this.game, keyObj, key, this.x, 0, this.width));
    }
  }

  keyDown(key) {
    if (this.keyBind.includes(key.toLowerCase())) {
      this.isKeyDown = true;
      
      // 이미 미스 판정이 난 노트는 무시하고, 살아있는 첫 번째 노트를 찾음
      const activeNoteIdx = this.noteArr.findIndex(n => !n.noteFailed);
      if (activeNoteIdx !== -1) {
        const note = this.noteArr[activeNoteIdx];
        const judge = note.judge();
        
        // 범위 내에 들어와서 맞췄을 경우 점수/콤보 처리
        if (judge !== "Miss") {
          this.vm.result.combo += 1;
          this.vm.result.maxCombo = Math.max(this.vm.result.combo, this.vm.result.maxCombo);
          this.vm.result.totalHitNotes += 1;
          this.vm.result.score += (judge === "MAX 100%" ? 100 : (judge === "MAX 90%" ? 90 : 50)); 
          
          if (judge === "MAX 100%") this.vm.result.marks.perfect += 1;
          else if (judge === "MAX 90%") this.vm.result.marks.good += 1;
          else this.vm.result.marks.offbeat += 1;

          if (this.vm.$refs.judgeDisplay) this.vm.$refs.judgeDisplay.judge(judge, this.vm.result.combo);
          if (this.particleEffect) this.particleEffect.create(this.x, this.game.checkHitLineY, this.width, 10, judge);
          
          // 타격 성공한 노트는 배열에서 즉시 소멸시킴
          this.noteArr.splice(activeNoteIdx, 1);
        }
      }
    }
  }

  keyUp(key) {
    if (this.keyBind.includes(key.toLowerCase())) this.isKeyDown = false;
  }

  update() {
    // 키빔 그리기
    if (this.isKeyDown) {
      let grad = this.game.ctx.createLinearGradient(0, this.game.checkHitLineY, 0, this.game.checkHitLineY - 150);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      this.game.ctx.fillStyle = grad;
      this.game.ctx.fillRect(this.x, this.game.checkHitLineY - 150, this.width, 150);
    }

    // 🚨 배열을 뒤에서부터 순회하며 노트 이동 및 화면 밖으로 나간 찌꺼기 노트 제거
    for (let i = this.noteArr.length - 1; i >= 0; i--) {
      this.noteArr[i].update();
      if (this.noteArr[i].y > this.game.canvas.height + 50) {
        this.noteArr.splice(i, 1);
      }
    }
    
    if (this.particleEffect) this.particleEffect.update(this.isKeyDown);
  }
}

// === 여기서부터는 건드리지 않는 시각 효과 전용 클래스 ===
export class HitEffect {
  constructor(vm) {
    this.colorData = ["yellow", "#DED51F", "#EBA400", "#FCC138"];
    this.reductionFactor = 5;
    this.particles = [];
    this.ctx = vm.effectCtx;
    this.vm = vm;
  }

  create(mX, mY, mWidth, height, judge) {
    let x = mX + mWidth / 2 - 5;
    let y = mY;
    if (this.vm.perspective) y -= 35;
    let width = 10;
    let count = 0;
    const rgb = this.getRgb(judge);
    this.circle = new ExpandingCircle(x + 5, y, rgb);
    this.holdCircle = new SpiningCircle(x + 5, y, rgb);

    for (let localX = 0; localX < width; localX++) {
      for (let localY = 0; localY < height; localY++) {
        if (count % this.reductionFactor === 0) {
          this.createParticleAtPoint(x + localX, y + localY, [`rgb(${rgb})`]);
        }
        count++;
      }
    }
  }

  createParticleAtPoint(x, y, colorData) {
    const particle = new ExplodingParticle(this.ctx);
    particle.rgbArray = colorData;
    particle.startX = x;
    particle.startY = y;
    particle.startTime = Date.now();
    this.particles.push(particle);
  }

  getRgb(judge) {
    switch (judge) {
      case "MAX 100%": return "3, 252, 32"; 
      case "MAX 90%": return "3, 223, 252"; 
      case "MAX 50%": return "255, 0, 55";  
      default: return "255, 255, 0";
    }
  }

  update(drawHoldEffect) {
    this.circle?.draw(this.ctx);
    if (drawHoldEffect) this.holdCircle?.draw(this.ctx);
    for (let i = 0; i < this.particles.length; i++) {
      this.ctx.globalAlpha = 0.7;
      this.particles[i].draw(this.ctx);
      this.ctx.globalAlpha = 1;
      if (i === this.particles.length - 1) {
        const percent = (Date.now() - this.particles[i].startTime) / this.particles[i].animationDuration;
        if (percent > 1) { this.particles = []; this.circle = null; }
      }
    }
  }
}

class ExplodingParticle {
  constructor() {
    this.animationDuration = 1000;
    this.speed = { x: -5 + Math.random() * 10, y: -5 + Math.random() * 10 };
    this.radius = 5 + Math.random() * 10;
    this.remainingLife = 20 + Math.random() * 10;
  }
  draw(ctx) {
    if (this.remainingLife > 0 && this.radius > 0) {
      ctx.beginPath();
      ctx.fillStyle = this.rgbArray[Math.floor(Math.random() * this.rgbArray.length)];
      ctx.fillRect(this.startX, this.startY, this.radius, this.radius);
      this.remainingLife--;
      this.radius -= 0.25;
      this.startX += this.speed.x;
      this.startY += this.speed.y;
    }
  }
}

class SpiningCircle {
  constructor(x, y, rgb) {
    this.x = x; this.y = y; this.offset = Math.random(); this.radius = 100; this.rgb = rgb;
  }
  draw(ctx) {
    if (this.radius > 30) {
      let os = this.offset; let percent = 1 - this.radius / 100;
      ctx.strokeStyle = `rgba(${this.rgb}, ${1 - percent})`;
      ctx.lineWidth = 30 + 20 * percent;
      ctx.beginPath(); ctx.arc(this.x, this.y, 80, (os + 0) * Math.PI, (os + 0.5) * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(this.x, this.y, 80, (os + 1) * Math.PI, (os + 1.5) * Math.PI); ctx.stroke();
      this.offset += 0.1 - percent / 10;
    }
  }
}

class ExpandingCircle {
  constructor(x, y, rgb) {
    this.x = x; this.y = y; this.offset = Math.random(); this.radius = 30; this.rgb = rgb;
  }
  drawCircle(ctx, radius, percent) {
    const innerRadius = radius * 0.1, outerRadius = radius * 1.1;
    const gradient = ctx.createRadialGradient(this.x, this.y, innerRadius, this.x, this.y, outerRadius);
    gradient.addColorStop(0, `rgba(${this.rgb},0)`); gradient.addColorStop(1, `rgba(${this.rgb}, ${1 - percent})`);
    ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient; ctx.fill();
  }
  draw(ctx) {
    if (this.radius < 100) {
      let percent = this.radius / 100;
      this.drawCircle(ctx, this.radius + 20, percent);
      this.radius += 5;
    }
  }
}