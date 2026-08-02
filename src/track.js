import { Note } from "./note";

const LANE_COLOR = "#111827";
const LANE_BORDER = "#35c2ff";
const HIT_LINE_COLOR = "#e0f7ff";
const PRESSED_FILL = "rgba(60, 160, 255, 0.18)";

export default class Track {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.x = options.x || 0;
    this.width = options.width || 180;
    this.height = options.height || ctx.canvas.height;
    this.judgeLineY = options.judgeLineY || ctx.canvas.height * 0.82;
    this.keyBind = (options.keyBind || "d").toLowerCase();
    this.speedPxPerSec = options.speedPxPerSec || 560;
    this.onJudge = options.onJudge || function () {};
    this.activeNotes = [];
    this.isPressed = false;
  }

  spawnNote() {
    const note = Note.allocate({
      x: this.x + (this.width - 48) / 2,
      y: -18,
      width: 48,
      height: 18,
      speedPxPerSec: this.speedPxPerSec,
      judgeLineY: this.judgeLineY,
      onHit: (note, judgment) => this._handleHit(note, judgment),
      onMiss: (note) => this._handleMiss(note),
      color: "#7af4ff",
    });
    this.activeNotes.push(note);
  }

  handleKeyDown(key) {
    if (key.toLowerCase() !== this.keyBind) return;
    this.isPressed = true;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const note of this.activeNotes) {
      if (note.noteFailed) continue;
      const distance = Math.abs(note.bottomY - this.judgeLineY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = note;
      }
    }
    if (!nearest) return;
    const judgment = nearest.hit();
    if (judgment) {
      this._cleanupNote(nearest);
      this.onJudge({ judge: judgment, note: nearest });
    }
  }

  handleKeyUp(key) {
    if (key.toLowerCase() !== this.keyBind) return;
    this.isPressed = false;
  }

  update(dt) {
    for (let i = this.activeNotes.length - 1; i >= 0; i -= 1) {
      const note = this.activeNotes[i];
      note.update(dt);
      if (note.noteFailed) {
        this._cleanupNote(note);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = LANE_COLOR;
    ctx.fillRect(this.x, 0, this.width, this.height);
    ctx.strokeStyle = LANE_BORDER;
    ctx.lineWidth = 4;
    ctx.strokeRect(this.x + 2, 2, this.width - 4, this.height - 4);

    if (this.isPressed) {
      ctx.fillStyle = PRESSED_FILL;
      ctx.fillRect(this.x, 0, this.width, this.judgeLineY);
    }

    ctx.strokeStyle = HIT_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.judgeLineY);
    ctx.lineTo(this.x + this.width, this.judgeLineY);
    ctx.stroke();

    for (const note of this.activeNotes) {
      note.render(ctx);
    }
  }

  _handleHit(_note, _judgment) {
    // no-op: cleanup handled in handleKeyDown
  }

  _handleMiss(note) {
    this.onJudge({ judge: "Miss", note });
    this._cleanupNote(note);
  }

  _cleanupNote(note) {
    const index = this.activeNotes.indexOf(note);
    if (index !== -1) {
      this.activeNotes.splice(index, 1);
    }
    Note.release(note);
  }
}
