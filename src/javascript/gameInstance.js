import DropTrack from "./track";
import FeverEffect from "./FeverEffect";
import YoutubePlayer from "./youtube";

const KeyCode = { KEY_LEFT: 37, KEY_RIGHT: 39, ESC: 27, P: 80, SPACE: 32 };

export default class GameInstance {
  constructor(vm) {
    this.canvas = vm.canvas;
    this.ctx = vm.ctx;
    this.effectCanvas = vm.effectCanvas;
    this.effectCtx = vm.effectCtx;
    this.audio = vm.audio;
    this.vm = vm;
    this.timeArr = [];
    this.timeArrIdx = 0;
    this.currentTime = 0;
    this.playTime = 0; 
    this.paused = true; 
    this.keyHoldingStatus = {};
    this.speedPopupTimer = 0; 

    this.ytPlayer = new YoutubePlayer(vm);
    this.feverEff = new FeverEffect(vm, this);
    this.createTracks(4);
    this.registerInput();
    this.destoryed = false;
    this.update();
  }

  createTracks(trackNum) {
    this.dropTrackArr = [];
    this.trackNum = trackNum;
    this.trackKeyBind = ["d", "f", "j", "k"];
    this.setUserKeyBind();
    for (const keyBind of this.trackKeyBind) {
      this.dropTrackArr.push(new DropTrack(this.vm, this, 0, 150, keyBind));
    }
    this.reposition();
  }

  setUserKeyBind() {
    this.userKeyBind = this.trackKeyBind;
    this.reverseKeyMap = {};
  }

  getKeyName(keyEvent) {
    return keyEvent.key.toLowerCase();
  }

  async reposition() {
    this.canvas.width = this.vm.wrapper?.clientWidth || window.innerWidth;
    this.canvas.height = this.vm.wrapper?.clientHeight || window.innerHeight;
    this.effectCanvas.width = this.canvas.width;
    this.effectCanvas.height = this.canvas.height;

    const trackWidth = Math.min(this.canvas.width / this.trackNum, 140);
    const startX = (this.canvas.width / 2) - (this.trackNum * trackWidth / 2);

    this.dropTrackArr.forEach((track, i) => {
      track.resizeTrack(startX + (trackWidth * i), trackWidth);
    });

    this.startX = startX;
    this.endX = startX + (trackWidth * this.trackNum);
    this.checkHitLineY = this.canvas.height * 0.82; 
    
    this.noteSpeedPxPerSec = 400 * (this.vm.noteSpeed || 1.0) * (this.vm.playbackSpeed || 1);
    this.noteDelay = this.checkHitLineY / this.noteSpeedPxPerSec;
    
    const foundIdx = this.timeArr.findIndex(e => e.t > this.currentTime);
    this.timeArrIdx = foundIdx !== -1 ? foundIdx : 0;
  }

  registerInput() {
    this.keydownEvent = (event) => {
      const key = this.getKeyName(event);
      if (event.keyCode === 49) { 
        this.vm.noteSpeed = Math.max(1.0, (this.vm.noteSpeed || 1.0) - 0.1);
        this.speedPopupTimer = 80;
        this.reposition();
      } else if (event.keyCode === 50) { 
        this.vm.noteSpeed = Math.min(10.0, (this.vm.noteSpeed || 1.0) + 0.1);
        this.speedPopupTimer = 80;
        this.reposition();
      }
      this.onKeyDown(key);
      if (event.keyCode === KeyCode.ESC) {
        this.paused ? this.resumeGame(true) : this.pauseGame();
      }
    };
    this.keyupEvent = (event) => this.onKeyUp(this.getKeyName(event));
    window.addEventListener("resize", () => this.reposition());
    document.addEventListener("keydown", this.keydownEvent);
    document.addEventListener("keyup", this.keyupEvent);
  }

  async onKeyDown(key) {
    if (this.keyHoldingStatus[key]) return;
    this.keyHoldingStatus[key] = true;
    this.dropTrackArr.forEach(track => track.keyDown(key));
  }

  async onKeyUp(key) {
    this.keyHoldingStatus[key] = false;
    this.dropTrackArr.forEach(track => track.keyUp(key));
  }

  update(time) {
    if (this.destoryed) return;
    requestAnimationFrame(this.update.bind(this));
    
    if (!this.paused) this.updateCurrentTime();
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.effectCtx.clearRect(0, 0, this.effectCanvas.width, this.effectCanvas.height);
    
    this.drawDecoration();
    this.dropTrackArr.forEach(track => track.update());
    this.drawUI();
  }

  drawUI() {
    const currentSpeed = (this.vm.noteSpeed || 1.0).toFixed(1);
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "white";
    this.ctx.font = "20px Arial";
    this.ctx.fillText(`SPEED x${currentSpeed}`, (this.startX + this.endX) / 2, 40);

    if (this.speedPopupTimer > 0) {
      const alpha = Math.min(1, this.speedPopupTimer / 40);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.font = "bold 60px Arial";
      this.ctx.fillText(`x${currentSpeed}`, this.canvas.width / 2, this.canvas.height / 2);
      this.speedPopupTimer--;
    }
  }

  drawDecoration() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = "rgba(10, 10, 10, 1)"; 
    this.ctx.fillRect(this.startX, 0, this.endX - this.startX, this.canvas.height);
    
    this.ctx.fillStyle = "rgba(30, 30, 30, 1)";
    this.ctx.fillRect(this.startX, this.checkHitLineY, this.endX - this.startX, this.canvas.height - this.checkHitLineY);

    this.ctx.fillStyle = "rgba(255, 200, 200, 0.6)"; 
    this.ctx.fillRect(this.startX - 5, 0, 5, this.canvas.height);
    this.ctx.fillRect(this.endX, 0, 5, this.canvas.height);

    this.ctx.fillStyle = "rgba(255, 50, 50, 1)"; 
    this.ctx.fillRect(this.startX - 5, this.checkHitLineY, (this.endX - this.startX) + 10, 4);
  }

  // 🚨 딱 이 부분만 this.ytPlayer.getPlayerTime() 으로 원상복구 했습니다!
  async updateCurrentTime() {
    const cTime = this.vm.srcMode === "youtube" ? await this.ytPlayer.getPlayerTime() : this.audio.getCurrentTime();
    this.currentTime = cTime || 0;
    this.playTime = this.currentTime + this.noteDelay + 1.0; 
  }

  startSong() {
    this.resetPlaying();
    this.vm.started = true;
    this.reposition();
    this.resumeGame(true); 
    this.intervalPlay = setInterval(this.gameTimingLoop.bind(this), 20);
  }

  async gameTimingLoop() {
    if (this.paused) return;
    
    while (this.timeArr && this.timeArrIdx < this.timeArr.length) {
      const noteObj = this.timeArr[this.timeArrIdx];
      
      if (noteObj.t > this.playTime) break;
      
      const fallbackKeys = ["d", "f", "j", "k"];
      let k = noteObj.k;
      if (k === undefined && noteObj.key !== undefined) k = fallbackKeys[noteObj.key];
      
      if (k) {
        this.dropTrackArr.forEach(track => track.dropNote(k, noteObj));
      }
      this.timeArrIdx++;
    }
  }

  seekTo(time) {
    if (this.vm.srcMode === "youtube") {
      if (this.vm.ytPlayer && typeof this.vm.ytPlayer.seekTo === 'function') {
        this.vm.ytPlayer.seekTo(time);
      }
    } else {
      this.audio.seek(time);
    }
  }

  resetPlaying() {
    clearInterval(this.intervalPlay);
    this.vm.started = false;
    this.timeArrIdx = 0;
    this.dropTrackArr.forEach(track => track.noteArr = []);
  }

  loadSong(song) {
    this.resetPlaying();
    this.vm.currentSong = song;
    this.vm.srcMode = song.srcMode;
    this.timeArr = typeof song.sheet === 'string' ? JSON.parse(song.sheet) : song.sheet;
    this.startSongAt = song.startAt ?? 0;
    if (song.srcMode === "youtube") {
        this.ytPlayer.loadYoutubeVideo(song.youtubeId);
    }
  }

  pauseGame() {
    this.paused = true;
    if (this.vm.srcMode === "youtube") {
        if(this.vm.ytPlayer && typeof this.vm.ytPlayer.pauseVideo === 'function') this.vm.ytPlayer.pauseVideo();
    } else {
        this.audio.pause();
    }
  }

  resumeGame(firstPlay) {
    this.paused = false;
    if (firstPlay) this.seekTo(this.startSongAt);
    
    if (this.vm.srcMode === "youtube") {
      if(this.vm.ytPlayer && typeof this.vm.ytPlayer.playVideo === 'function') {
        this.vm.ytPlayer.playVideo();
        if (typeof this.vm.ytPlayer.setVolume === 'function') this.vm.ytPlayer.setVolume(100);
      }
    } else {
      this.audio.play();
    }
  }
}