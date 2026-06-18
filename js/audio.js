'use strict';

/* All audio is synthesized live with the Web Audio API — no asset files. */
const Sfx = {
  ctx: null, master: null, sfxGain: null, comp: null, noiseBuf: null,
  muted: false, baseVol: 0.9,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.baseVol;
    // gentle limiter so the punched-up SFX glue together and never clip
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 20;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;
    this.comp.connect(this.master);
    this.master.connect(ctx.destination);
    // SFX bus, boosted — the synthesized blips were far quieter than the music
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 1.7;
    this.sfxGain.connect(this.comp);
    const len = ctx.sampleRate | 0;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  /* one global mute switch covering SFX (master gain) and the MP3 music
     (element.muted), persisted so the choice survives reloads */
  loadMutePref() {
    try { this.muted = localStorage.getItem('sg_muted') === '1'; } catch (e) { /* private */ }
    return this.muted;
  },
  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.baseVol;
    this.music.applyMute();
    if (typeof BG !== 'undefined' && BG.applyMute) BG.applyMute(); // video ambience too
    try { localStorage.setItem('sg_muted', this.muted ? '1' : '0'); } catch (e) { /* private */ }
    return this.muted;
  },
  toggleMute() { return this.setMuted(!this.muted); },

  tone(o) {
    if (!this.ctx) return;
    const { type = 'square', f0 = 440, f1, dur = 0.1, vol = 0.15, attack = 0.002, delay = 0 } = o;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  noise(o) {
    if (!this.ctx) return;
    const { dur = 0.3, vol = 0.2, f0 = 1500, f1 = 150, q = 0.8, type = 'lowpass', delay = 0 } = o;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(Math.max(10, f0), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  },

  shoot(kind) {
    // blorpy, wet-sounding pews
    if (kind === 'pulse') this.tone({ type: 'square', f0: 480, f1: 90, dur: 0.09, vol: 0.05 });
    else if (kind === 'scatter') this.tone({ type: 'sawtooth', f0: 640, f1: 140, dur: 0.11, vol: 0.05 });
    else if (kind === 'missile') this.noise({ dur: 0.22, vol: 0.09, f0: 2600, f1: 320, type: 'bandpass', q: 1.4 });
    else if (kind === 'beam') this.tone({ type: 'sawtooth', f0: 96, f1: 80, dur: 0.12, vol: 0.035 });
  },
  enemyShoot() { this.tone({ type: 'triangle', f0: 220, f1: 55, dur: 0.12, vol: 0.04 }); },
  hit() { this.tone({ type: 'triangle', f0: 420, f1: 120, dur: 0.05, vol: 0.05 }); },
  boom(size = 1) {
    // splat first, rumble after
    this.tone({ type: 'triangle', f0: 500, f1: 50, dur: 0.16 + 0.08 * size, vol: 0.08 });
    this.noise({ dur: 0.32 + 0.28 * size, vol: 0.16 + 0.1 * size, f0: 1400, f1: 50 });
    this.tone({ type: 'sine', f0: 150 + 40 * size, f1: 28, dur: 0.3 + 0.25 * size, vol: 0.22, attack: 0.005 });
  },
  pickup() {
    // gulp-blub-bloop
    this.tone({ type: 'sine', f0: 240, f1: 520, dur: 0.07, vol: 0.09 });
    this.tone({ type: 'sine', f0: 660, f1: 880, dur: 0.09, vol: 0.1, delay: 0.06 });
    this.tone({ type: 'sine', f0: 990, f1: 1320, dur: 0.14, vol: 0.1, delay: 0.13 });
  },
  weaponUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.1, vol: 0.06, delay: i * 0.06 }));
  },
  hurt() {
    this.noise({ dur: 0.4, vol: 0.22, f0: 900, f1: 60 });
    this.tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 0.35, vol: 0.16 });
  },
  shieldPop() { this.tone({ type: 'sine', f0: 1200, f1: 200, dur: 0.25, vol: 0.14 }); },
  whoosh() { this.noise({ dur: 0.3, vol: 0.06, f0: 400, f1: 1800, type: 'bandpass', q: 1.2 }); },
  alarm() {
    for (let i = 0; i < 3; i++) {
      this.tone({ type: 'sawtooth', f0: 660, f1: 440, dur: 0.3, vol: 0.08, delay: i * 0.42 });
      this.tone({ type: 'sawtooth', f0: 663, f1: 442, dur: 0.3, vol: 0.08, delay: i * 0.42 + 0.012 });
    }
  },
  warnTone() { this.tone({ type: 'sawtooth', f0: 880, f1: 440, dur: 0.5, vol: 0.1 }); },
  beamBlast() { this.noise({ dur: 0.8, vol: 0.2, f0: 3000, f1: 300 }); },
  jingle() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.09, delay: i * 0.11 }));
  },

  /* Streamed MP3 soundtrack. A single reusable <audio> element plays one track
     at a time and loops; swapping its src changes track. Using one element that
     gets unlocked by the first user gesture means later programmatic track
     changes (death, victory) keep working on mobile, where a fresh element
     would be blocked from auto-playing. theme → menu + victory, lvl1 →
     gameplay, gameover → death screen. */
  music: {
    // named shortcuts; world tracks are passed as raw paths (e.g. 'audio/world3.mp3')
    files: { theme: 'audio/theme.mp3', lvl1: 'audio/lvl1.mp3', gameover: 'audio/gameover.mp3' },
    el: null, currentSrc: null,

    audio() {
      if (!this.el) {
        const a = new Audio();
        a.loop = true;        // loops if the track ends before the level does
        a.preload = 'auto';
        a.volume = 0.45;      // sits under the boosted SFX + level ambience
        this.el = a;
      }
      return this.el;
    },

    play(name) {
      if (!name) return;
      const src = this.files[name] || name; // accept a known key OR a direct path
      const a = this.audio();
      if (this.currentSrc === src && !a.paused) return; // already rolling
      a.muted = Sfx.muted;
      if (this.currentSrc !== src) {
        a.src = src;
        this.currentSrc = src;
      }
      try { a.currentTime = 0; } catch (e) { /* not seekable yet */ }
      a.play().catch(() => { /* needs a gesture; retried on the next tap */ });
    },

    stop() {
      if (this.el) this.el.pause();
      this.currentSrc = null;
    },

    // older call site: gameplay music
    start() { this.play('lvl1'); },

    applyMute() { if (this.el) this.el.muted = Sfx.muted; },
  },
};
