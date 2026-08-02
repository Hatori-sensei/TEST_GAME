const PERFECT_WINDOW_MS = 50;
const GREAT_WINDOW_MS = 100;
const GOOD_WINDOW_MS = 175;
const NOTE_HEIGHT = 18;
const NOTE_WIDTH = 48;
const NOTE_COLOR = "#7af4ff";
const MISS_COLOR = "rgba(255, 255, 255, 0.18)";

export class Note {
  static pool = [];

  static allocate(options) {
    const note = Note.pool.pop() || new Note();
    note.configure(options);
    return note;
  }

  static release(note) {
    note.reset();
    Note.pool.push(note);
  }

  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = NOTE_WIDTH;
    this.height = NOTE_HEIGHT;
    this.speedPxPerSec = 0;
    this.judgeLineY = 0;
    this.onHit = null;
    this.onMiss = null;
    this.noteFailed = false;
    this.color = NOTE_COLOR;
  }

  configure(options) {
    this.x = options.x;
    this.y = options.y !== undefined ? options.y : -this.height;
    this.width = options.width || NOTE_WIDTH;
    this.height = options.height || NOTE_HEIGHT;
    this.speedPxPerSec = options.speedPxPerSec;
    this.judgeLineY = options.judgeLineY;
    this.onHit = options.onHit;
    this.onMiss = options.onMiss;
    this.noteFailed = false;
    this.color = options.color || NOTE_COLOR;
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.width = NOTE_WIDTH;
    this.height = NOTE_HEIGHT;
    this.speedPxPerSec = 0;
    this.judgeLineY = 0;
    this.onHit = null;
    this.onMiss = null;
    this.noteFailed = false;
    this.color = NOTE_COLOR;
  }

  get bottomY() {
    return this.y + this.height;
  }

  update(dt) {
    if (this.noteFailed) return;
    // simple linear motion: y increases by constant speed * dt
    const move = this.speedPxPerSec * dt;
    this.y += move;

    // check miss: if bottom passed beyond Good window -> miss
    const passedPx = this.bottomY - this.judgeLineY;
    const missDistancePx = (GOOD_WINDOW_MS / 1000) * this.speedPxPerSec;
    if (passedPx > missDistancePx) {
      this.noteFailed = true;
      if (typeof this.onMiss === "function") this.onMiss(this);
    }
  }

  hit() {
    if (this.noteFailed) return null;
    if (!this.speedPxPerSec || this.speedPxPerSec <= 0) return null;
    const diffPx = Math.abs(this.bottomY - this.judgeLineY);
    const diffMs = (diffPx / this.speedPxPerSec) * 1000;
    if (diffMs > GOOD_WINDOW_MS) return null;

    let judgment = "Good";
    if (diffMs <= PERFECT_WINDOW_MS) judgment = "Perfect";
    else if (diffMs <= GREAT_WINDOW_MS) judgment = "Great";

    this.noteFailed = true;
    if (typeof this.onHit === "function") this.onHit(this, judgment);
    return judgment;
  }

  render(ctx) {
    ctx.fillStyle = this.noteFailed ? MISS_COLOR : this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
