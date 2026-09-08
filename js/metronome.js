/* ============================================================
 * Tiny Metronome — audio engine
 * Web Audio API lookahead scheduler ("A Tale of Two Clocks").
 * All sounds are synthesized; no audio assets, no dependencies.
 * ============================================================ */
(function (global) {
  'use strict';

  const BPM_MIN = 20;
  const BPM_MAX = 300;
  const LOOKAHEAD = 0.12;        // seconds scheduled ahead of the audio clock
  const LOOKAHEAD_HIDDEN = 1.6;  // background tabs throttle timers — schedule further out
  const TICK_MS = 25;            // scheduler wakeup interval

  /* ---------- helpers ---------- */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  let _noiseBuf = null;
  function noiseBuffer(ctx) {
    if (_noiseBuf && _noiseBuf.sampleRate === ctx.sampleRate) return _noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    _noiseBuf = buf;
    return buf;
  }

  /* ---------- sound recipes ----------
   * Each takes (ctx, dest, t, level, accent) and schedules one click
   * that starts at audio time `t`.
   * ---------------------------------- */

  function playWood(ctx, dest, t, level, accent) {
    // wood block: damped sine + a short noise "knock"
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1750 : 1220, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.09);
    return [osc, knock(ctx, dest, t, level * 0.55, 2400)];
  }

  function knock(ctx, dest, t, level, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.04);
    return src;
  }

  function playBeep(ctx, dest, t, level, accent) {
    // clean electronic blip
    const f = accent ? 1318 : 880;
    const out = ctx.createGain();
    out.gain.setValueAtTime(level, t);
    out.gain.setValueAtTime(level, t + 0.045);
    out.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    out.connect(dest);
    const nodes = [out];
    for (const [type, amp] of [['sine', 0.9], ['square', 0.28]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.1);
      nodes.push(o);
    }
    return nodes;
  }

  function playDrum(ctx, dest, t, level, accent) {
    // practice-friendly kick drum with pitch drop
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(accent ? 200 : 155, t);
    o.frequency.exponentialRampToValueAtTime(accent ? 55 : 46, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (accent ? 0.22 : 0.15));
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.25);
    return [o];
  }

  function playHat(ctx, dest, t, level, accent) {
    // closed hi-hat style click
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = accent ? 6800 : 5600;
    const g = ctx.createGain();
    const dur = accent ? 0.055 : 0.03;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
    return [src];
  }

  const SOUNDS = {
    wood: playWood,
    beep: playBeep,
    drum: playDrum,
    hat: playHat,
  };

  /* ---------- engine ---------- */

  class Metronome {
    constructor() {
      this.bpm = 120;
      this.beatsPerMeasure = 4;
      this.pattern = [0];                  // click offsets within one beat, 0..1, ascending
      this.accents = [true, false, false, false]; // per main beat
      this.volume = 0.8;                 // 0..1
      this.sound = 'wood';

      this._ctx = null;
      this._master = null;
      this._timerId = null;
      this._nextClickTime = 0;
      this._beatIdx = 0;                 // beat within the measure
      this._clickIdx = 0;                // index into this.pattern
      this._beatStart = 0;               // audio time of the current beat's first click
      this._absBeat = 0;                 // pendulum anchor: beats since start
      this._anchorTime = 0;
      this._lookahead = LOOKAHEAD;
      this._drawQueue = [];              // { time, beat, sub, isMain, accent }
      this._active = new Set();          // scheduled sources, for instant stop
      this.running = false;
      this.onBeat = null;                // optional hook (fired with audio-time events)
    }

    get context() { return this._ctx; }

    _ensureContext() {
      if (!this._ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        this._ctx = new AC();
        this._master = this._ctx.createGain();
        const comp = this._ctx.createDynamicsCompressor();
        comp.threshold.value = -6;
        comp.ratio.value = 12;
        this._master.connect(comp).connect(this._ctx.destination);
      }
      if (this._ctx.state === 'suspended') this._ctx.resume();
    }

    setBpm(v) { this.bpm = clamp(Math.round(v), BPM_MIN, BPM_MAX); }

    setBeats(n) {
      this.beatsPerMeasure = clamp(Math.round(n), 1, 16);
      const acc = this.accents.slice(0, this.beatsPerMeasure);
      while (acc.length < this.beatsPerMeasure) acc.push(false);
      this.accents = acc;
    }

    setPattern(offsets) {
      const p = [...offsets]
        .map((v) => Math.min(0.99, Math.max(0, +v || 0)))
        .sort((a, b) => a - b);
      if (!p.length || p[0] !== 0) p.unshift(0);
      const changed = JSON.stringify(p) !== JSON.stringify(this.pattern);
      this.pattern = p;
      // take effect cleanly at the next downbeat (no stray clicks mid-beat)
      if (changed && this.running) {
        this._clickIdx = 0;
        this._beatIdx = (this._beatIdx + 1) % this.beatsPerMeasure;
        this._beatStart += 60 / this.bpm;
        this._nextClickTime = this._beatStart;
      }
    }

    start() {
      if (this.running) return;
      this._ensureContext();
      this.running = true;
      this._beatIdx = 0;
      this._clickIdx = 0;
      this._absBeat = 0;
      this._anchorTime = this._ctx.currentTime + 0.08;
      this._drawQueue.length = 0;
      this._beatStart = this._ctx.currentTime + 0.08;
      this._nextClickTime = this._beatStart + this.pattern[0] * (60 / this.bpm);
      this._timerId = setInterval(() => this._scheduler(), TICK_MS);
      this._scheduler();
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      clearInterval(this._timerId);
      for (const node of this._active) {
        try { node.stop(0); } catch (e) { /* already stopped */ }
      }
      this._active.clear();
      this._drawQueue.length = 0;
    }

    _scheduler() {
      const ctx = this._ctx;
      while (this._nextClickTime < ctx.currentTime + this._lookahead) {
        this._scheduleClick(this._beatIdx, this._clickIdx, this._nextClickTime);
        this._advance();
      }
    }

    _advance() {
      const beatDur = 60 / this.bpm;
      this._clickIdx++;
      if (this._clickIdx >= this.pattern.length) {
        this._clickIdx = 0;
        this._beatIdx = (this._beatIdx + 1) % this.beatsPerMeasure;
        this._beatStart += beatDur;
      }
      this._nextClickTime = this._beatStart + this.pattern[this._clickIdx] * beatDur;
    }

    _scheduleClick(beat, clickIdx, t) {
      const isMain = clickIdx === 0;
      const accent = isMain && !!this.accents[beat];
      const level = isMain
        ? (accent ? this.volume : this.volume * 0.72)
        : this.volume * 0.38;

      if (isMain) { this._absBeat += 1; this._anchorTime = t; }

      if (level > 0.001) {
        const nodes = SOUNDS[this.sound](this._ctx, this._master, t, level, accent) || [];
        for (const n of nodes) {
          this._active.add(n);
          n.onended = () => this._active.delete(n);
        }
      }
      this._drawQueue.push({ time: t, beat, sub: clickIdx, isMain, accent });
    }

    /** Pop visual events whose audio time is due. Call from rAF. */
    collectDue() {
      const now = this._ctx ? this._ctx.currentTime : 0;
      const due = [];
      while (this._drawQueue.length && this._drawQueue[0].time <= now + 0.004) {
        due.push(this._drawQueue.shift());
      }
      return due;
    }

    /** Continuous beat position (for the pendulum), valid while running. */
    beatFloat() {
      if (!this._ctx) return 0;
      return this._absBeat + (this._ctx.currentTime - this._anchorTime) / (60 / this.bpm);
    }

    /** Keep scheduling precisely when the tab is backgrounded. */
    setBackgroundMode(hidden) {
      this._lookahead = hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
    }
  }

  Metronome.BPM_MIN = BPM_MIN;
  Metronome.BPM_MAX = BPM_MAX;
  Metronome.SOUNDS = Object.keys(SOUNDS);

  global.Metronome = Metronome;
})(window);
