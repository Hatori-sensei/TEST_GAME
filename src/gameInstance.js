// src/gameInstance.js
// Responsibilities:
// - Manage Howler.js audio playback and provide precise audio time access
// - Drive a requestAnimationFrame main loop and invoke onTick callbacks with audio-synced timing
// - Keep rendering/UI concerns out of this module (it only provides timing data)

import { Howl } from "howler";

class GameInstance {
  /**
   * options:
   *  - audioSrc: string (required) - path/URL to audio file
   *  - onTick: function({ audioTime, dt, perfNow }) called each RAF step
   *  - html5: boolean (optional, default true) - pass-through to Howl for large files
   */
  constructor(options = {}) {
    if (!options.audioSrc) throw new Error("audioSrc is required");
    this.audioSrc = options.audioSrc;
    this.onTick = options.onTick || function () {};
    this.html5 = options.html5 !== undefined ? options.html5 : true;

    this.howl = null;
    this._rafId = null;
    this._lastPerfTime = null;
    this._isRunning = false;

    // Small smoothing state for drift corrections
    this._lastAudioTime = 0;
    this._smoothedDt = 0;
  }

  // Load audio (returns a Promise resolved when loaded or rejects on error)
  load() {
    if (this.howl) return Promise.resolve(this.howl);
    return new Promise((resolve, reject) => {
      this.howl = new Howl({
        src: [this.audioSrc],
        html5: this.html5,
        onload: () => resolve(this.howl),
        onloaderror: (id, err) => reject(err),
        onplayerror: (id, err) => {
          // attempt unlock/play on mobile-like restrictions
          // consumer can handle errors as needed
          console.warn("Howl playerror", err);
        },
      });
    });
  }

  // Start playback and the RAF loop
  async play() {
    if (!this.howl) await this.load();
    this.howl.play();
    this._startLoop();
    this._isRunning = true;
  }

  // Pause playback and stop RAF loop
  pause() {
    if (this.howl) this.howl.pause();
    this._stopLoop();
    this._isRunning = false;
  }

  // Stop playback and reset playhead
  stop() {
    if (this.howl) this.howl.stop();
    this._stopLoop();
    this._isRunning = false;
  }

  // Seek to seconds (Howl's seek) - accepts seconds
  seek(secs) {
    if (this.howl) this.howl.seek(secs);
  }

  // Get current audio time in seconds (Howl.seek() is currentTime)
  getAudioTime() {
    if (!this.howl) return 0;
    // Howler's seek() may return number or object depending on version; guard it
    const s = this.howl.seek();
    return typeof s === "number" ? s : 0;
  }

  isRunning() {
    return this._isRunning;
  }

  _startLoop() {
    if (this._rafId) return; // already running
    this._lastPerfTime = performance.now();
    this._lastAudioTime = this.getAudioTime();

    const step = (perfNow) => {
      this._rafId = requestAnimationFrame(step);

      // compute delta time using performance timestamps for stable frame dt
      const dtMs = perfNow - this._lastPerfTime;
      const dt = Math.max(0, dtMs / 1000);
      this._lastPerfTime = perfNow;

      // audio time from Howler is authoritative
      const audioTime = this.getAudioTime();

      // basic sanity: if audioTime backward jumps (seeked), reset lastAudioTime
      if (Math.abs(audioTime - this._lastAudioTime) > 1.0) {
        // big jump (seek) — avoid using derived dt
        this._smoothedDt = dt;
      } else {
        // smooth dt to mitigate small drift
        this._smoothedDt = this._smoothedDt * 0.9 + dt * 0.1;
      }

      this._lastAudioTime = audioTime;

      // Callback provides authoritative audioTime and a frame dt for rendering/updating
      try {
        this.onTick({ audioTime, dt: this._smoothedDt, perfNow });
      } catch (e) {
        // Protect main loop from callback errors
        console.error("Error in onTick callback:", e);
      }
    };

    // start the loop
    this._rafId = requestAnimationFrame(step);
  }

  _stopLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}

export default GameInstance;

/*
Usage example (in another module):

const GameInstance = require('./gameInstance');

const gi = new GameInstance({
  audioSrc: 'assets/audio/song.mp3',
  onTick: ({ audioTime, dt }) => {
    // audioTime: seconds since song start (Howler authoritative)
    // dt: seconds since previous RAF step (smoothed)
    // Do not perform DOM writes here if you want separation of concerns.
    // Instead, emit these values to track/renderer modules.
  }
});

await gi.load();
gi.play();

the renderer/tracks can call gi.seek(x) or gi.pause()/gi.play() as needed.
*/
