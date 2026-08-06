const assetsBaseUrl = "https://assets.rhythm-plus.com/bgm/";
const mediaBaseUrl = "http://localhost:3000";

export default class Audio {
  constructor() {
    this.audioData = {
      audioCtx: null,
      analyser: null,
      bufferLength: null,
      dataArray: null,
    };
    this.maxVolume = 0.7;
    this.player = null;
    this.mediaSourceNode = null;
    this.muteBg = false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioData.audioCtx = AudioCtx ? new AudioCtx() : null;
    this.installAudioUnlock();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pause();
      } else if (this.asBackground) {
        this.play();
      }
    });
  }

  async loadSong(
    songSrc,
    asBackground,
    loadedCallback,
    finishedCallback,
    errorCallback
  ) {
    this.stop(true);
    this.asBackground = asBackground;

    const resolvedSrc = this.toMediaUrl(songSrc);
    const audioElement = new window.Audio();
    audioElement.crossOrigin = "anonymous";
    audioElement.preload = "auto";
    audioElement.loop = !!asBackground;
    audioElement.volume = this.muteBg && asBackground ? 0 : this.maxVolume;
    audioElement.src = resolvedSrc;
    this.player = audioElement;

    this.bindAnalyser(audioElement);

    const onCanPlay = () => {
      if (loadedCallback) loadedCallback();
      Logger.log("Audio loaded");
      if (asBackground) {
        this.safePlay(audioElement, "Audio play blocked");
      }
    };

    const onEnded = () => {
      if (finishedCallback) finishedCallback();
      if (asBackground) this.playBgm(audioElement.src);
    };

    const onError = () => {
      if (errorCallback) errorCallback();
    };

    this.attachMediaHandler(audioElement, "canplaythrough", onCanPlay, true);
    this.attachMediaHandler(audioElement, "ended", onEnded);
    this.attachMediaHandler(audioElement, "error", onError, true);

    if (
      audioElement instanceof HTMLMediaElement &&
      typeof audioElement.load === "function"
    ) {
      audioElement.load();
    }
  }

  toMediaUrl(songSrc) {
    if (!songSrc) return "";
    const src = String(songSrc).trim();
    if (/^https?:\/\//i.test(src) || /^data:/i.test(src)) return src;
    const clean = src.replace(/^\.?[\\/]+/, "").replace(/\\/g, "/");
    if (clean.startsWith("songs/")) return `${mediaBaseUrl}/${clean}`;
    return `${mediaBaseUrl}/songs/${clean}`;
  }

  bindAnalyser(sound) {
    const ctx = this.audioData.audioCtx;
    if (!ctx || !sound) return;

    const audioElement =
      sound instanceof HTMLMediaElement
        ? sound
        : sound?._sounds?.[0]?._node instanceof HTMLMediaElement
          ? sound._sounds[0]._node
          : null;

    if (!audioElement) return;

    if (
      this.mediaSourceNode &&
      this.mediaSourceElement &&
      this.mediaSourceElement === audioElement &&
      this.audioData.analyser
    ) {
      return;
    }

    if (this.mediaSourceNode) {
      try {
        this.mediaSourceNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.mediaSourceNode = null;
      this.mediaSourceElement = null;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    try {
      this.mediaSourceNode = ctx.createMediaElementSource(audioElement);
      this.mediaSourceElement = audioElement;
    } catch (e) {
      if (e && e.name === "InvalidStateError") {
        return;
      }
      throw e;
    }

    this.mediaSourceNode.connect(analyser);
    analyser.connect(ctx.destination);

    this.audioData.bufferLength = analyser.frequencyBinCount;
    this.audioData.dataArray = new Uint8Array(this.audioData.bufferLength);
    this.audioData.analyser = analyser;
  }

  attachMediaHandler(sound, eventName, handler, once = false) {
    if (!sound || typeof handler !== "function") return;
    if (sound instanceof HTMLMediaElement) {
      sound.addEventListener(eventName, handler, once ? { once: true } : false);
      return;
    }
    if (typeof sound.on === "function") {
      if (once && typeof sound.once === "function") {
        sound.once(eventName, handler);
      } else {
        sound.on(eventName, handler);
      }
    }
  }

  safePlay(sound, warnMessage = "Audio play blocked") {
    if (!sound || typeof sound.play !== "function") return;
    this.resumeCtx().then(() => {
      try {
        const playResult = sound.play();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch((err) => {
            Logger.warn(warnMessage, err);
          });
        }
      } catch (err) {
        Logger.warn(warnMessage, err);
      }
    });
  }

  installAudioUnlock() {
    const unlock = () => {
      this.resumeCtx();
    };
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("mousedown", unlock, true);
  }

  async resumeCtx() {
    const ctx = this.audioData.audioCtx;
    if (!ctx || ctx.state !== "suspended") return;
    try {
      await ctx.resume();
    } catch (e) {
      // ignore and retry on next input
    }
  }

  playBgm(songToExclude) {
    // randomly play background music
    let bgmUrlArr = [
      assetsBaseUrl + "aurora.mp3",
      assetsBaseUrl + "beyond.mp3",
      // assetsBaseUrl + "machinery.mp3",
    ];
    if (songToExclude && !bgmUrlArr.includes(songToExclude)) return; // is playing result bgm
    shuffle(bgmUrlArr);
    bgmUrlArr.filter((e) => e !== songToExclude);
    this.stop();
    Logger.log(bgmUrlArr);
    this.loadSong(bgmUrlArr[0], true);
  }

  playEffect(name) {
    const url = `/audio/effects/${name}.mp3`;
    const effectPlayer = new window.Audio(url);
    effectPlayer.volume = 0.5;
    this.safePlay(effectPlayer, "Effect audio play blocked");
  }

  playHoverEffect(name) {
    if (window.innerWidth > 1000) this.playEffect(name);
  }

  stop(stopBackground) {
    if (!stopBackground && this.asBackground) return;
    if (!this.player) return;
    Logger.warn("stop", this.player, this.asBackground);
    if (typeof this.player.stop === "function") {
      this.player.stop();
    } else if (typeof this.player.pause === "function") {
      this.player.pause();
    }

    if (typeof this.player.currentTime === "number") {
      this.player.currentTime = 0;
    }

    if (this.player instanceof HTMLMediaElement) {
      if (typeof this.player.removeAttribute === "function") {
        this.player.removeAttribute("src");
      }
      if (typeof this.player.load === "function") {
        this.player.load();
      }
    }

    if (this.asBackground) {
      this.player = null;
    }
  }

  pause() {
    if (!this.player) return;
    if (typeof this.player.pause === "function") {
      this.player.pause();
    }
  }

  play() {
    if (!this.player) return;
    this.safePlay(this.player, "Audio play blocked");
  }

  mute(mute) {
    if (!this.player) return;
    this.player.volume = mute ? 0 : this.maxVolume;
  }

  toggleBgMute() {
    this.muteBg = !this.muteBg;
    this.mute(this.muteBg);
  }

  fadeOut(duration = 300) {
    if (!this.player) return;
    const start = this.player.volume;
    const stepMs = 30;
    const steps = Math.max(1, Math.floor(duration / stepMs));
    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      const nextVolume = Math.max(0, start * (1 - idx / steps));
      this.player.volume = nextVolume;
      if (idx >= steps) {
        clearInterval(timer);
      }
    }, stepMs);
  }

  getCurrentTime() {
    return this.player ? this.player.currentTime : 0;
  }

  seek(sec) {
    if (!this.player) return;
    this.player.currentTime = sec;
  }

  getDuration() {
    return this.player?.duration;
  }

  setRate(rate) {
    if (!this.player) return;
    this.player.playbackRate = rate;
  }
}

function shuffle(array) {
  //ref https://stackoverflow.com/questions/2450954/

  let currentIndex = array.length;
  let randomIndex = 0;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}
