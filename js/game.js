'use strict';

/* global shared leaderboard — reads from scores.json in the repo (GitHub raw) */
const GlobalScores = {
  URL: 'https://raw.githubusercontent.com/shaiolivaalon/gemini-3-test/main/scores.json',
  KEY: 'sg_gcache', TTL: 120000, MAX: 10,
  cached: null,
  load() {
    try {
      const c = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (c && c.ts && Date.now() - c.ts < this.TTL) { this.cached = c.scores; return Promise.resolve(c.scores); }
    } catch (_) {}
    return fetch(this.URL + '?_=' + Date.now())
      .then(r => r.ok ? r.json() : { scores: [] })
      .then(d => {
        const scores = Array.isArray(d && d.scores) ? d.scores : [];
        try { localStorage.setItem(this.KEY, JSON.stringify({ ts: Date.now(), scores })); } catch (_) {}
        this.cached = scores;
        return scores;
      })
      .catch(() => this.cached || []);
  },
};

/* persistent local top-scores table */
const HighScores = {
  KEY: 'sg_scores', MAX: 8,
  load() {
    try {
      const l = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      return Array.isArray(l) ? l.filter(e => e && typeof e.score === 'number') : [];
    } catch (e) { return []; }
  },
  save(list) { try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) { /* private mode */ } },
  qualifies(score) {
    if (score <= 0) return false;
    const l = this.load();
    return l.length < this.MAX || score > l[l.length - 1].score;
  },
  add(name, score) {
    const l = this.load();
    const entry = { name: name || 'YOU', score };
    l.push(entry);
    l.sort((a, b) => b.score - a.score);
    if (l.length > this.MAX) l.length = this.MAX;
    this.save(l);
    return l.indexOf(entry);
  },
};

/* trash-talk shown on the end screens — picked at random so it keeps stinging */
const TROLL = {
  over: [
    'even the toilets fought better than you',
    'the boogers are laughing at you',
    'you flew like expired mayonnaise',
    'a wet sock would have lasted longer',
    'the donuts didn’t even try hard',
    'skill issue. profoundly, a skill issue',
    'your ship smelled fear. and feet',
    'the cake didn’t even need to show up',
  ],
  clear: [
    'fine. you didn’t completely embarrass yourself',
    'the cake is flushed. you got lucky',
    'okay, that was less pathetic than expected',
    'galaxy saved. nobody will thank you',
    'you win. the smell remains, though',
  ],
};

/* random 80s-cartoon comic reactions — themed per world, fired sparingly so they
   stay funny instead of nagging */
const Comics = {
  el: null, hideT: 0,
  POOLS: {
    hit:   ['OOF!', 'SKILL ISSUE', 'BONK!', "THAT'LL STAIN", 'GET GOOD, GROSSER', 'MY GRANDMA DODGES BETTER', 'OUCH-ARONI', 'L + RATIO'],
    clear: ['WAVE WIPED!', 'EW-NORMOUS!', 'GROSS-TASTIC!', 'NOT BAD… FOR YOU', 'FLAWLESS-ISH', 'THEY NEVER STOOD A CHANCE'],
    bonus: ['OOH SHINY', 'YOINK!', 'LOOT GOBLIN', 'FREE GUNK!', 'TASTY UPGRADE', 'GIMME GIMME'],
  },
  WORLD: {
    0: { hit: ['TOO SWEET TO LIVE?', 'SUGAR CRASH!'], clear: ['CANDY CRUSHED!'] },
    1: { hit: ['TRASHED!', 'YOU GOT DUMPSTERED'], clear: ['TAKING OUT THE TRASH'] },
    2: { hit: ['EAT MY DUST', 'BONE-DRY SKILLS'], clear: ['DUST SETTLED'] },
    3: { hit: ['FLUSHED AGAIN?', 'DOWN THE DRAIN'], clear: ['BOWL CLEANED'] },
    4: { hit: ['ICE COLD, BRO', 'BRAIN FREEZE!'], clear: ['FREEZER DEFROSTED'] },
    5: { hit: ['DEAD MEAT', 'GRAVE MISTAKE'], clear: ['REST IN PIECES'] },
    6: { hit: ['THE VOID LAUGHS', 'REALITY BITES'], clear: ['THE ABYSS BLINKED'] },
  },
  init(el) { this.el = el; },
  say(type, x, y, chance) {
    if (!this.el || Math.random() > (chance || 0.4)) return;
    const w = (typeof Level !== 'undefined' && Level.worldIdx) || 0;
    let pool = (this.POOLS[type] || []).slice();
    const wf = this.WORLD[w] && this.WORLD[w][type];
    if (wf) pool = pool.concat(wf, wf); // weight world-specific lines
    if (!pool.length) return;
    const el = this.el, g = Game;
    el.textContent = U.pick(pool);
    let sx = x != null ? x * g.scale : g.W / 2;
    let sy = y != null ? y * g.scale : g.H * 0.4;
    el.style.left = U.clamp(sx, 90, g.W - 90) + 'px';
    el.style.top = U.clamp(sy - 70, 70, g.H - 130) + 'px';
    el.style.setProperty('--tilt', ((Math.random() * 16 - 8) | 0) + 'deg');
    el.classList.remove('hit', 'clear', 'bonus', 'show');
    void el.offsetWidth;
    el.classList.add(type, 'show');
    this.hideT = 1.3;
    Sfx.comic(type);
  },
  update(dt) { if (this.hideT > 0 && (this.hideT -= dt) <= 0) this.el && this.el.classList.remove('show'); },
};

const Game = {
  canvas: null, ctx: null, dpr: 1,
  W: 0, H: 0, scale: 1, LW: 420, LH: 800,
  state: 'title', time: 0,
  SHIPS: [
    { key: 'player',      name: 'PIZZA' },
    { key: 'ship_condom', name: 'CONDOM' },
    { key: 'ship_beer',   name: 'BEER' },
    { key: 'ship_coffee', name: 'LATTE' },
    { key: 'ship_banana', name: 'BANANA' },
    { key: 'ship_shoe',   name: 'SHOE' },
  ],
  selectedShipKey: 'player',
  player: null, boss: null,
  enemies: [], pbullets: [], ebullets: [], powerups: [], splats: [],
  paused: false,
  dda: 1, hitFreeWave: true, kills: 0, // dynamic difficulty: >1 harder, <1 easier
  charge: 0, charging: false, plasmas: [], // hold to charge → release a plasma orb
  score: 0, dispScore: -1, combo: 0, comboT: 0, maxCombo: 0,
  shakeAmp: 0, hitstop: 0, beamY: -10,
  lastHp: -1, lastWeapon: '', lastBoost: '§', lastCombo: -1,
  waveSignT: 0, waveSignKey: '',
  els: {},

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const ids = [
      'hud', 'score', 'combo', 'hearts', 'weapon', 'boosts',
      'bossbar', 'bossname', 'bossfill', 'banner', 'banner-main', 'banner-sub', 'flash',
      'screen-title', 'screen-over', 'screen-clear', 'screen-pause', 'btn-pause', 'btn-charge', 'chargefill',
      'final-score', 'clear-score', 'clear-chain', 'best', 'over-sub', 'clear-sub',
      'hsentry-over', 'hsname-over', 'hssave-over', 'scores-over', 'gscores-over',
      'hsentry-clear', 'hsname-clear', 'hssave-clear', 'scores-clear', 'gscores-clear',
    ];
    for (const id of ids) this.els[id] = document.getElementById(id);
    Comics.init(document.getElementById('comic'));
    this.resize();
    this.player = new Player(this);
    let best = 0;
    try { best = +(localStorage.getItem('sg_best') || 0); } catch (e) { /* private mode */ }
    if (best) this.els.best.textContent = 'BEST ' + best.toLocaleString();
  },

  resize() {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.scale = Math.min(this.W / 420, this.H / 800);
    this.LW = this.W / this.scale;
    this.LH = this.H / this.scale;
    BG.init(this.LW, this.LH, this.scale * this.dpr);
    if (this.player && this.state !== 'playing') {
      this.player.x = this.LW / 2;
      this.player.y = this.LH - 120;
    }
  },

  start() {
    this.state = 'playing';
    this.score = 0;
    this.dispScore = -1;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboT = 0;
    this.enemies.length = 0;
    this.pbullets.length = 0;
    this.ebullets.length = 0;
    this.powerups.length = 0;
    this.splats.length = 0;
    this.boss = null;
    this.shakeAmp = 0;
    this.hitstop = 0;
    Particles.list.length = 0;
    Popups.list.length = 0;
    this.player.reset();
    Level.reset(this);
    BG.travel = 0;        // start at the bottom of the background
    BG.leveling = true;   // pan up toward the boss as waves clear
    this.lastHp = -1;
    this.lastWeapon = '';
    this.lastBoost = '§';
    this.lastCombo = -1;
    this.dda = 1;
    this.hitFreeWave = true;
    this.kills = 0;
    this.charge = 0;
    this.charging = false;
    this.plasmas.length = 0;
    this.paused = false;
    this.els['screen-title'].classList.add('hidden');
    this.els['screen-over'].classList.add('hidden');
    this.els['screen-clear'].classList.add('hidden');
    this.els['screen-pause'].classList.add('hidden');
    this.els.bossbar.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this.els['btn-pause'].classList.remove('hidden');
    this.els['btn-charge'].classList.remove('hidden');
  },

  // release the held charge as a PLASMA orb — a fat slug that flies up and melts
  // every enemy inside its radius (not the whole screen). Bigger charge = bigger
  // orb + more damage.
  releaseCharge() {
    if (this.state !== 'playing' || this.paused || !this.player.alive) return;
    if (this.charge < 0.4) return;
    const power = this.charge;
    this.charge = 0;
    this.plasmas.push({
      x: this.player.x, y: this.player.y - 18, vy: -300,
      r: 44 + power * 92, dmg: 50 + power * 150, life: 1.9, hit: [], bossHit: false,
    });
    Sfx.beamBlast();
    this.shake(7 + power * 9);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.flash('rgba(150,255,120,0.28)');
    Particles.burst(this.player.x, this.player.y - 16, '#b7ff2e', 18, 280, { life: 0.45, size: 3 });
    Comics.say('bonus', this.player.x, this.player.y - 54, 0.4);
  },

  // dev: jump straight to a world + wave (wave -1 = go to the boss)
  devJump(world, wave) {
    Sfx.init(); Sfx.resume();
    if (this.state !== 'playing') this.start();
    this.enemies.length = 0; this.pbullets.length = 0; this.ebullets.length = 0;
    this.powerups.length = 0; this.splats.length = 0; this.boss = null;
    this.els.bossbar.classList.add('hidden');
    Level.loadWorld(this, U.clamp(world, 0, WORLDS.length - 1));
    if (wave < 0) { Level.waveIdx = Level.waves.length; Level.bossSpawned = false; }
    else { Level.waveIdx = U.clamp(wave, 0, Level.waves.length) - 1; }
    Level.queue = []; Level.betweenT = 0.15; Level.done = false;
    BG.travel = 0; BG.leveling = true;
    this.paused = false;
    this.els['screen-pause'].classList.add('hidden');
    this.els['btn-pause'].classList.remove('hidden');
  },

  togglePause(force) {
    const want = force !== undefined ? force : !this.paused;
    if (want === this.paused) return;
    if (want && this.state !== 'playing') return; // only pause an active run
    this.paused = want;
    this.els['screen-pause'].classList.toggle('hidden', !this.paused);
    this.els['btn-pause'].textContent = this.paused ? '▶' : '❚❚';
    if (this.paused) {
      Sfx.music.pauseAll();
      if (BG.video) BG.video.pause();
    } else {
      Sfx.resume();
      Sfx.music.resumeAll();
      if (BG.video && BG._videoSrc) BG.video.play().catch(() => {});
    }
  },

  bullet(x, y, vx, vy, dmg, type) {
    return {
      x, y, vx, vy, dmg, type, r: type === 'missile' ? 6 : 4,
      hue: (Math.random() * 360) | 0, dead: false, smoke: 0,
    };
  },

  shake(a) { this.shakeAmp = Math.max(this.shakeAmp, a); },

  flash(color) {
    const f = this.els.flash;
    f.style.background = color;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  },

  banner(main, sub = '', warn = false) {
    const b = this.els.banner;
    const waveMap = { 'WAVE 1': 'wave1', 'WAVE 2': 'wave2', 'WAVE 3': 'wave3', 'WAVE 4': 'wave4', 'WAVE 5': 'wave5', 'WAVE 6': 'wave6' };
    this.waveSignKey = waveMap[main] || (warn ? 'boss_alert' : '');
    // sprite art already contains the wave/boss label — hide HTML text so it doesn't double up
    this.els['banner-main'].textContent = this.waveSignKey ? '' : main;
    this.els['banner-sub'].textContent = sub;
    b.classList.toggle('warn', warn);
    b.classList.remove('hidden', 'show');
    void b.offsetWidth;
    b.classList.add('show');
    this.waveSignT = warn ? 3.5 : 2.8;
  },

  update(dt) {
    this.time += dt;
    BG.update(dt);
    Particles.update(dt);
    Popups.update(dt);
    Comics.update(dt);
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      s.t += dt;
      if (s.t >= s.life) this.splats.splice(i, 1);
    }
    if (this.shakeAmp > 0) this.shakeAmp = Math.max(0, this.shakeAmp - dt * 30);
    if (this.waveSignT > 0) this.waveSignT = Math.max(0, this.waveSignT - dt);
    if (this.state !== 'playing') { Input.consume(); return; }

    const p = this.player;
    if (p.alive) p.update(dt);
    Level.update(dt, this);
    // ease the background pan toward the level's progress (bottom→top, boss=top)
    BG.travel += (Level.progress() - BG.travel) * Math.min(1, dt * 0.5);
    if (this.boss) this.boss.update(dt);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);
      if (e.dead) this.enemies.splice(i, 1);
    }

    // player bullets
    for (let i = this.pbullets.length - 1; i >= 0; i--) {
      const b = this.pbullets[i];
      if (b.type === 'missile') this.steerMissile(b, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.x < -30 || b.x > this.LW + 30 || b.y > this.LH + 30) {
        this.pbullets.splice(i, 1);
        continue;
      }
      for (const e of this.enemies) {
        if (e.delay > 0 || e.dead) continue;
        const rr = e.r + b.r;
        if (U.dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          e.damage(b.dmg, this);
          this.impact(b);
          b.dead = true;
          break;
        }
      }
      if (!b.dead && this.boss && this.boss.hitTest(b.x, b.y, b.r)) {
        this.boss.damage(b.dmg, this);
        this.impact(b);
        b.dead = true;
      }
      if (b.dead) this.pbullets.splice(i, 1);
    }

    if (p.alive && p.weapon === 'beam') this.beamUpdate(dt);

    // enemy bullets
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > this.LH + 24 || b.y < -24 || b.x < -24 || b.x > this.LW + 24) {
        this.ebullets.splice(i, 1);
        continue;
      }
      if (p.alive && U.dist2(b.x, b.y, p.x, p.y) < (12 + b.r) * (12 + b.r)) {
        this.ebullets.splice(i, 1);
        p.hit();
      }
    }

    // enemy bodies vs player
    if (p.alive) {
      for (const e of this.enemies) {
        if (e.delay > 0 || e.dead) continue;
        const rr = e.r + 13;
        if (U.dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          e.damage(35, this);
          p.hit();
        }
      }
    }

    // boss beam vs player
    if (p.alive && this.boss && this.boss.beamState === 2) {
      if (Math.abs(p.x - this.boss.beamX) < 26 && p.y > this.boss.y) p.hit();
    }

    // powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i];
      u.update(dt, this);
      if (!u.dead && p.alive && U.dist2(u.x, u.y, p.x, p.y) < 30 * 30) {
        this.collect(u);
        u.dead = true;
      }
      if (u.dead) this.powerups.splice(i, 1);
    }

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.charge = Math.min(1, this.charge + dt * (this.charging ? 0.55 : 0.02)); // builds fast while held
    // plasma orbs: fly up, melt every enemy inside their radius (once each)
    for (let i = this.plasmas.length - 1; i >= 0; i--) {
      const pl = this.plasmas[i];
      pl.y += pl.vy * dt;
      pl.life -= dt;
      for (const e of this.enemies) {
        if (e.delay > 0 || e.dead || pl.hit.indexOf(e) >= 0) continue;
        const rr = pl.r + e.r;
        if (U.dist2(pl.x, pl.y, e.x, e.y) < rr * rr) { pl.hit.push(e); e.damage(pl.dmg, this); }
      }
      if (!pl.bossHit && this.boss && this.boss.hitTest(pl.x, pl.y, pl.r)) { pl.bossHit = true; this.boss.damage(pl.dmg, this); }
      Particles.spawn({ x: pl.x + U.rand(-pl.r * 0.3, pl.r * 0.3), y: pl.y + U.rand(-6, 10), vx: U.rand(-30, 30), vy: U.rand(20, 70), color: '#b7ff2e', size: 3, life: 0.3, glow: 10 });
      if (pl.life <= 0 || pl.y < -pl.r) this.plasmas.splice(i, 1);
    }
    // music watchdog: if the level track ever stalls/stops, nudge it back to life
    const mc = Sfx.music.els && Sfx.music.els[Sfx.music.cur];
    if (mc && mc.paused && Sfx.music.currentSrc && !Sfx.music.fade) mc.play().catch(() => {});
    this.updateHud();
  },

  steerMissile(b, dt) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.delay > 0 || e.dead) continue;
      const d = U.dist2(b.x, b.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && this.boss.state === 'fight') {
      const d = U.dist2(b.x, b.y, this.boss.x, this.boss.y);
      if (d < bd) { bd = d; best = this.boss; }
    }
    if (best) {
      const want = U.angTo(b.x, b.y, best.x, best.y);
      const cur = Math.atan2(b.vy, b.vx);
      let da = want - cur;
      while (da > Math.PI) da -= U.TAU;
      while (da < -Math.PI) da += U.TAU;
      const na = cur + U.clamp(da, -7 * dt, 7 * dt);
      b.vx = Math.cos(na) * 560;
      b.vy = Math.sin(na) * 560;
    }
    b.smoke -= dt;
    if (b.smoke <= 0) {
      b.smoke = 0.03;
      Particles.spawn({
        x: b.x, y: b.y, vx: U.rand(-10, 10), vy: U.rand(-10, 10),
        color: '#7df9ff', type: 'flame', size: 2.5, life: 0.3, glow: 8, drag: 1,
      });
    }
  },

  beamUpdate(dt) {
    const p = this.player;
    p.beamTick -= dt;
    let hit = null, hy = -1;
    for (const e of this.enemies) {
      if (e.delay > 0 || e.dead || e.y > p.y) continue;
      if (Math.abs(e.x - p.x) < e.r + 5 && e.y > hy) { hy = e.y; hit = e; }
    }
    let bossHit = false;
    if (!hit && this.boss && this.boss.state === 'fight' &&
        Math.abs(this.boss.x - p.x) < 95 && this.boss.y < p.y) {
      bossHit = true;
      hy = this.boss.y + 40;
    }
    this.beamY = hit ? hit.y + hit.r : bossHit ? hy : -10;
    if (p.beamTick <= 0) {
      p.beamTick = 0.06;
      if (hit) hit.damage(7, this);
      else if (bossHit) this.boss.damage(7, this);
      if (hit || bossHit) {
        Particles.spawn({
          x: p.x + U.rand(-4, 4), y: this.beamY,
          vx: U.rand(-90, 90), vy: U.rand(-60, 30),
          color: '#ffd02e', size: 2.5, life: 0.25, glow: 10,
        });
      }
    }
  },

  impact(b) {
    const colors = { pulse: '#ffb347', scatter: '#ff4dd8', missile: '#9fd8e8' };
    Particles.burst(b.x, b.y, colors[b.type] || '#fff', 4, 130, { life: 0.2, size: 2 });
    if (b.type === 'missile') {
      Particles.explosion(b.x, b.y, '#9fd8e8', 0.6);
      Sfx.boom(0.3);
      this.shake(2);
    }
  },

  // one-shot animated gross splat from a keyed FX sheet (plays once, fades out)
  splat(x, y, key, scale) {
    if (!SPR.ok(key)) return;
    const f = FRAMES[key];
    const life = f.fps > 0 ? f.n / f.fps : 0.3;
    this.splats.push({ x, y, key, t: 0, life, scale: scale || 1 });
  },

  killEnemy(e) {
    this.combo++;
    this.comboT = 2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const gain = Math.round((e.spec.score + Math.min(this.combo, 10) * 10) * this.player.mult);
    this.score += gain;
    Popups.spawn(e.x, e.y, '+' + gain, this.player.mult > 1 ? '#c86bff' : '#d8ffc0', 13);
    if (this.combo >= 3) {
      Popups.spawn(e.x, e.y - 18,
        '×' + this.combo + ' ' + U.pick(['EW!', 'GROSS!', 'NASTY!', 'YUCK!', 'SPLAT!', 'BARF!', 'SQUELCH!', 'OOZE!']),
        '#ffd84d', 11);
    }
    Particles.explosion(e.x, e.y, e.spec.color, e.type === 'sentry' ? 1.25 : e.type === 'mite' ? 0.6 : 1);
    this.splat(e.x, e.y, U.pick(['poop_splat', 'blood_splat', 'yellow_spl', 'rainbow_exp']),
      e.type === 'sentry' ? 2.1 : e.type === 'mite' ? 0.9 : 1.5);
    Sfx.boom(e.type === 'sentry' ? 0.9 : 0.55);
    this.shake(e.type === 'sentry' ? 5 : 3);
    this.hitstop = Math.max(this.hitstop, 0.025);
    U.vibrate(12);
    if (e.type === 'splitter') {
      for (const s of [-1, 1]) {
        const m = new Enemy('mite', { from: { x: e.x + s * 14, y: e.y }, slot: { x: e.x + s * 14, y: e.y } });
        m.phase = 'live';
        this.enemies.push(m);
      }
    } else if (Math.random() < 0.13 * (2 - this.dda)) { // struggling players get more drops
      this.powerups.push(new PowerUp(e.x, e.y, U.pick(['shield', 'over', 'mult', 'repair'])));
    }
    this.charge = Math.min(1, this.charge + 0.045); // kills build the charge blast
    this.kills = (this.kills || 0) + 1; // for adaptive difficulty
    // wave-clear comic when this was the last enemy standing
    if (!this.boss && Level.queue && Level.queue.length === 0 && this.enemies.length <= 1 &&
        Level.waveIdx >= 0 && !Level.bossSpawned) {
      Comics.say('clear', this.LW / 2, this.LH * 0.34, 0.55);
      if (this.hitFreeWave) this.dda = Math.min(1.4, this.dda + 0.07); // cleared untouched → ramp up
      this.hitFreeWave = true;
    }
  },

  collect(u) {
    const p = this.player, k = u.kind;
    Sfx.pickup();
    U.vibrate(15);
    Particles.burst(u.x, u.y, BOOSTS[k].color, 10, 160, { life: 0.35 });
    let label = '';
    if (BOOSTS[k].weapon) {
      p.weapon = k;
      p.weaponT = 16;
      label = WEAPONS[k].name;
      Sfx.weaponUp();
    } else if (k === 'shield') { p.shield = 1; label = 'BUBBLE GUM'; }
    else if (k === 'over') { p.over = 8; label = 'HOT SAUCE!'; }
    else if (k === 'mult') { p.mult = 2; p.multT = 12; label = 'SCORE ×2'; }
    else if (k === 'repair') { p.hp = Math.min(p.maxHp, p.hp + 1); label = 'TP PATCH'; }
    Popups.spawn(u.x, u.y, label, BOOSTS[k].color, 12);
    Comics.say('bonus', u.x, u.y, 0.5);
  },

  spawnBoss() {
    this.boss = new Boss(this);
    this.els.bossbar.classList.remove('hidden');
    this.shake(6);
  },

  bossDown() {
    const b = this.boss;
    this.score += 5000;
    Popups.spawn(b.x, b.y, '+5000', '#ffd84d', 18);
    for (const e of this.enemies) Particles.explosion(e.x, e.y, e.spec.color, 0.7);
    this.enemies.length = 0;
    this.ebullets.length = 0;
    this.boss = null;
    this.els.bossbar.classList.add('hidden');
    Level.done = true;
    this.flash('rgba(255,255,255,0.5)');
    setTimeout(() => this.advanceWorld(), 1600);
  },

  // swap the background, music and boss name when a world (re)loads
  applyWorld(world, idx) {
    BG.setWorld(world);
    Sfx.music.play(world.music);
    this.els.bossname.textContent = '⚠ ' + world.boss;
    this.banner('WORLD ' + (idx + 1), world.name);
  },

  // after a boss falls: on to the next world, or final victory after world 7
  advanceWorld() {
    if (this.state !== 'playing') return;
    const next = Level.worldIdx + 1;
    if (next < WORLDS.length) {
      this.combo = 0;
      this.score += 2000; // clearing a world bonus
      if (this.player.hp < this.player.maxHp) this.player.hp++; // small mercy between worlds
      Level.loadWorld(this, next);
      BG.travel = 0;
      BG.leveling = true;
    } else {
      const w = WORLDS[Level.worldIdx];
      if (w && w.ending) BG.setVideo(w.ending); // abyss ending scene behind the victory screen
      this.levelClear();
    }
  },

  playerDestroyed() {
    Particles.explosion(this.player.x, this.player.y, '#ffb347', 2.2);
    Sfx.boom(1.6);
    this.shake(22);
    this.hitstop = 0.25;
    U.vibrate([90, 60, 140]);
    this.flash('rgba(255,60,80,0.4)');
    setTimeout(() => this.gameOver(), 1300);
  },

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    BG.leveling = false;
    Sfx.music.play('gameover');
    this.saveBest();
    this.els['over-sub'].textContent = U.pick(TROLL.over);
    this.els['final-score'].textContent = this.score.toLocaleString();
    this.els['screen-over'].classList.remove('hidden');
    this.els.hud.classList.add('hidden');
    this.els['btn-pause'].classList.add('hidden');
    this.els['btn-charge'].classList.add('hidden');
    this.paused = false; this.els['screen-pause'].classList.add('hidden');
    this.els.bossbar.classList.add('hidden');
    this.showHighScores('over');
  },

  levelClear() {
    if (this.state !== 'playing') return;
    this.state = 'clear';
    BG.leveling = false;
    Sfx.jingle();
    Sfx.music.play('gameover'); // "game over" track plays whenever the run ends — win or lose
    this.saveBest();
    this.els['clear-sub'].textContent = U.pick(TROLL.clear);
    this.els['clear-score'].textContent = this.score.toLocaleString();
    this.els['clear-chain'].textContent = '×' + this.maxCombo;
    this.els['screen-clear'].classList.remove('hidden');
    this.els.hud.classList.add('hidden');
    this.els['btn-pause'].classList.add('hidden');
    this.els['btn-charge'].classList.add('hidden');
    this.paused = false; this.els['screen-pause'].classList.add('hidden');
    this.showHighScores('clear');
  },

  // top-score table with name entry when the run qualifies
  showHighScores(suffix) {
    const entry = this.els['hsentry-' + suffix];
    const board = this.els['scores-' + suffix];
    const gboard = this.els['gscores-' + suffix];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const renderLocal = (hi) => {
      const list = HighScores.load();
      board.innerHTML = list.length
        ? list.map((e, i) => `<div class="hsrow${i === hi ? ' me' : ''}"><span class="hsrank">${i + 1}</span><span class="hsnm">${esc(e.name)}</span><span class="hssc">${e.score.toLocaleString()}</span></div>`).join('')
        : '<div class="hsrow"><span class="hsnm">no scores yet — be the first!</span></div>';
    };
    if (HighScores.qualifies(this.score)) {
      entry.classList.remove('hidden');
      const input = this.els['hsname-' + suffix];
      input.value = '';
      renderLocal(-1);
      const submit = () => {
        if (entry.classList.contains('hidden')) return;
        const name = (input.value.trim() || 'YOU').slice(0, 12).toUpperCase();
        const idx = HighScores.add(name, this.score);
        entry.classList.add('hidden');
        renderLocal(idx);
        Sfx.weaponUp();
      };
      this.els['hssave-' + suffix].onclick = submit;
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
      setTimeout(() => { try { input.focus(); } catch (e) { /* ignore */ } }, 120);
    } else {
      entry.classList.add('hidden');
      renderLocal(-1);
    }
    // global hall of fame (async fetch)
    if (gboard) {
      gboard.innerHTML = '<div class="hsrow"><span class="hsnm hs-loading">fetching hall of grossness…</span></div>';
      GlobalScores.load().then(scores => {
        gboard.innerHTML = scores.length
          ? scores.slice(0, GlobalScores.MAX).map((e, i) => `<div class="hsrow"><span class="hsrank">${i + 1}</span><span class="hsnm">${esc(e.name)}</span><span class="hssc">${e.score.toLocaleString()}</span></div>`).join('')
          : '<div class="hsrow"><span class="hsnm hs-loading">no global scores yet</span></div>';
      });
    }
  },

  saveBest() {
    try {
      const best = +(localStorage.getItem('sg_best') || 0);
      if (this.score > best) localStorage.setItem('sg_best', this.score);
    } catch (e) { /* private mode */ }
  },

  updateHud() {
    const p = this.player, els = this.els;
    const ds = Math.ceil(U.lerp(this.dispScore < 0 ? 0 : this.dispScore, this.score, 0.18));
    if (ds !== this.dispScore) {
      this.dispScore = ds;
      els.score.textContent = ds.toLocaleString();
    }
    if (this.combo !== this.lastCombo) {
      this.lastCombo = this.combo;
      els.combo.textContent = this.combo >= 2 ? '×' + this.combo : '';
      if (this.combo >= 2) {
        els.combo.classList.remove('pop');
        void els.combo.offsetWidth;
        els.combo.classList.add('pop');
      }
    }
    if (p.hp !== this.lastHp) {
      this.lastHp = p.hp;
      let h = '';
      for (let i = 0; i < p.maxHp; i++) h += `<span class="hp${i < p.hp ? ' on' : ''}"></span>`;
      els.hearts.innerHTML = h;
    }
    const wn = WEAPONS[p.weapon].name + (p.weapon !== 'pulse' ? ' ' + Math.ceil(p.weaponT) : '');
    if (wn !== this.lastWeapon) {
      this.lastWeapon = wn;
      els.weapon.textContent = wn;
      els.weapon.style.color = WEAPONS[p.weapon].color;
    }
    let bs = '';
    if (p.shield > 0) bs += '<span class="chip" style="color:#ff8ad8">BUBBLE GUM</span>';
    if (p.over > 0) bs += `<span class="chip" style="color:#ff5e3a">HOT SAUCE ${Math.ceil(p.over)}</span>`;
    if (p.mult > 1) bs += `<span class="chip" style="color:#c86bff">×2 SCORE ${Math.ceil(p.multT)}</span>`;
    if (bs !== this.lastBoost) {
      this.lastBoost = bs;
      els.boosts.innerHTML = bs;
    }
    if (this.boss) {
      els.bossfill.style.width = Math.max(0, (this.boss.hp / this.boss.maxHp) * 100) + '%';
    }
    els.chargefill.style.height = (this.charge * 100) + '%';
    els['btn-charge'].classList.toggle('ready', this.charge >= 1);
  },

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    if (this.shakeAmp > 0.2) {
      ctx.translate(U.rand(-1, 1) * this.shakeAmp, U.rand(-1, 1) * this.shakeAmp);
    }
    BG.draw(ctx);
    for (const u of this.powerups) u.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    for (const e of this.enemies) e.draw(ctx, this);
    if (this.state === 'playing' && this.player.alive && this.player.weapon === 'beam') {
      this.drawBeam(ctx);
    }
    for (const b of this.pbullets) drawBullet(ctx, b);
    for (const b of this.ebullets) drawEnemyBullet(ctx, b, this.time);
    for (const pl of this.plasmas) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = pl.r * (0.86 + 0.14 * Math.sin(this.time * 28));
      const g = ctx.createRadialGradient(pl.x, pl.y, 0, pl.x, pl.y, rr);
      g.addColorStop(0, 'rgba(240,255,210,0.95)');
      g.addColorStop(0.45, 'rgba(138,255,58,0.6)');
      g.addColorStop(1, 'rgba(138,255,58,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, rr, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
    if (this.state === 'playing' && this.player.alive) this.player.draw(ctx);
    // charging glow building under the ship
    if (this.state === 'playing' && this.charging && this.charge > 0.05 && this.player.alive) {
      const p = this.player, cr = 8 + this.charge * 28;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y - 14, 0, p.x, p.y - 14, cr);
      g.addColorStop(0, `rgba(225,255,180,${0.45 + 0.45 * this.charge})`);
      g.addColorStop(1, 'rgba(138,255,58,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y - 14, cr, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
    Particles.draw(ctx);
    // animated gross splats from enemy deaths (keyed FX sheets)
    for (const s of this.splats) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = Math.max(0, 1 - (s.t / s.life) * 0.7);
      SPR.local(ctx, s.key, s.t, s.scale);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // wave sign sprite overlay
    if (this.waveSignT > 0 && this.waveSignKey) {
      const f = FRAMES[this.waveSignKey];
      if (f && Assets.ok(f.sheet)) {
        ctx.save();
        ctx.translate(this.LW / 2, this.LH * 0.38);
        const elapsed = 2.8 - this.waveSignT;
        const alpha = Math.min(1, elapsed / 0.25) * Math.min(1, this.waveSignT / 0.35);
        ctx.globalAlpha = alpha;
        SPR.local(ctx, this.waveSignKey, this.time, 2.0);
        ctx.restore();
      }
    }
    Popups.draw(ctx);
    if (this.state === 'playing') this.drawHUD(ctx);
  },

  // illustrated HUD drawn in screen pixels (slime score, numbered life heart,
  // slime boss meter); falls back to the HTML HUD if a sheet isn't loaded
  drawHUD(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const padTop = 10;
    // ---- score as slime digits, top-left (compact) ----
    if (Assets.ok('slimenums')) {
      const dh = 22;
      let x = 10;
      for (const c of this.score.toLocaleString()) {
        if (c === ',') {
          ctx.save(); ctx.translate(x, padTop); drawSheetCell(ctx, 'slimenums', 10, 4, 4, dh, dh); ctx.restore();
          x += dh * 0.42;
        } else {
          const code = c.charCodeAt(0);
          if (code >= 48 && code <= 57) {
            ctx.save(); ctx.translate(x, padTop); drawSheetCell(ctx, 'slimenums', code - 48, 4, 4, dh, dh); ctx.restore();
            x += dh * 0.64;
          }
        }
      }
    }
    // ---- numbered pizza-heart lives, top-right (compact) ----
    if (Assets.ok('heart') && this.player) {
      const hv = U.clamp(this.player.hp | 0, 0, 5);
      const hh = 30;
      ctx.save();
      ctx.translate(this.W - 12 - hh, padTop - 4);
      drawSheetCell(ctx, 'heart', 5 - hv, 4, 4, hh, hh);
      ctx.restore();
    }
    // ---- small weapon card, left of the lives ----
    if (Assets.ok('weaponcards') && this.player) {
      const map = { pulse: 1, scatter: 6, missile: 4, beam: 10 };
      const cell = map[this.player.weapon] != null ? map[this.player.weapon] : 1;
      const ww = 46;
      ctx.save();
      ctx.translate(this.W - 12 - 30 - 6 - ww, padTop - 8);
      drawSheetCell(ctx, 'weaponcards', cell, 4, 4, ww, ww);
      ctx.restore();
    }
    // ---- thin boss power meter pinned to the very top edge (clears the boss) ----
    if (this.boss && Assets.ok('healthbar')) {
      const img = Assets.imgs.healthbar;
      const cw = sheetW(img) / 4, ch = sheetH(img) / 4;
      const idx = Math.round(U.clamp(this.boss.hp / this.boss.maxHp, 0, 1) * 8);
      const col = idx % 4, row = (idx / 4) | 0;
      const bandY = row * ch + ch * 0.30, bandH = ch * 0.40; // crop just the bar band
      const bw = Math.min(180, this.W * 0.5), bh = 30;
      try { ctx.drawImage(img, col * cw, bandY, cw, bandH, (this.W - bw) / 2, 2, bw, bh); } catch (e) { /* not ready */ }
    }
  },

  drawBeam(ctx) {
    const p = this.player;
    const yTop = this.beamY;
    const yBot = p.y - 18;
    if (yBot <= yTop) return;
    const flick = 0.8 + Math.sin(this.time * 60) * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(p.x - 7, 0, p.x + 7, 0);
    g.addColorStop(0, 'rgba(255,208,46,0)');
    g.addColorStop(0.5, `rgba(255,208,46,${0.5 * flick})`);
    g.addColorStop(1, 'rgba(255,208,46,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 7, yTop, 14, yBot - yTop);
    ctx.fillStyle = `rgba(255,255,235,${0.75 * flick})`;
    ctx.shadowColor = '#ffd02e';
    ctx.shadowBlur = 14;
    ctx.fillRect(p.x - 1.6, yTop, 3.2, yBot - yTop);
    ctx.restore();
  },
};
