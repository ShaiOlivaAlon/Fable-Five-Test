'use strict';

/* All audio is synthesized live with the Web Audio API — no asset files. */
const Sfx = {
  ctx: null, master: null, sfxGain: null, musGain: null, noiseBuf: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musGain = ctx.createGain();
    this.musGain.gain.value = 0.55;
    this.musGain.connect(this.master);
    const len = ctx.sampleRate | 0;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

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

  bassNote(f, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    filt.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(filt).connect(g).connect(this.musGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
  kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.musGain);
    o.start(t);
    o.stop(t + 0.2);
  },
  hat(t, open) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    const dur = open ? 0.12 : 0.04;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.musGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  },

  /* dark synthwave loop: scheduled ahead of time in small chunks */
  music: {
    on: false, step: 0, nextT: 0, timer: null,
    bass: [55, 55, 0, 55, 0, 110, 55, 0, 65.41, 65.41, 0, 65.41, 0, 130.81, 49, 98],
    start() {
      if (!Sfx.ctx || this.on) return;
      this.on = true;
      this.step = 0;
      this.nextT = Sfx.ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.tick(), 80);
    },
    stop() {
      this.on = false;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    },
    tick() {
      if (!this.on) return;
      const ctx = Sfx.ctx, spb = 60 / 116 / 2;
      while (this.nextT < ctx.currentTime + 0.3) {
        const s = this.step & 15, t = this.nextT;
        const f = this.bass[s];
        if (f) Sfx.bassNote(f, t, spb * 0.85);
        if ((s & 3) === 0) Sfx.kick(t);
        if ((s & 3) === 2) Sfx.hat(t, s === 14);
        this.nextT += spb;
        this.step++;
      }
    },
  },
};
