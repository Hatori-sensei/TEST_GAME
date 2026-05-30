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

    // 🚨 1. 기어 넓이 충돌 완벽 해결!
    // 캔버스 기어 넓이가 화면마다 변하던 것을 CSS(500px)와 똑같이 맞춥니다.
    // 4키 기준, 1개당 125px로 고정하면 총 500px로 양옆 기어가 딱 맞아떨어집니다.
    const trackWidth = 125; 
    const startX = (this.canvas.width / 2) - (this.trackNum * trackWidth / 2);

    this.dropTrackArr.forEach((track, i) => {
      track.resizeTrack(startX + (trackWidth * i), trackWidth);
    });

    this.startX = startX;
    this.endX = startX + (trackWidth * this.trackNum);
    
    // 🚨 2. 판정선 위치 충돌 완벽 해결!
    // 캔버스가 자기 멋대로 곱하기(* 0.82) 하던 것을 CSS와 똑같이 바닥에서 140px로 고정합니다.
    this.checkHitLineY = this.canvas.height - 320; 
    
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
    // 배경 (블랙)
  
    // 🚨 노트보다 먼저 도화지에 그려지는 반투명 기어 배경
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; // 투명도는 여기서 0.3~0.5 등 입맛대로 조절!
    this.ctx.fillRect(this.startX, 0, this.endX - this.startX, this.canvas.height);
  
    
    // 🚨 여기서부터 캔버스가 그리던 '과거의 쓰레기 UI' 코드를 전부 지워버렸습니다! 🚨
    // (예전 회색 하단 박스 삭제)
    // (예전 분홍색 양옆 테두리 삭제)
    // (예전 겹쳐 보이던 빨간색 가로 판정선 삭제)
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