'use strict';

/* drone = flying donut · sentry = toilet alien · splitter = snot blob
   mite = booger · diver = zombie pickle */
const ENEMY = {
  drone:    { hp: 20, r: 18, score: 100, color: '#ff7ad1', fire: 0 },
  sentry:   { hp: 48, r: 22, score: 250, color: '#cfe6f0', fire: 2.4 },
  splitter: { hp: 34, r: 19, score: 200, color: '#8aff3a', fire: 0 },
  mite:     { hp: 10, r: 12, score: 60,  color: '#8aff3a', fire: 0 },
  diver:    { hp: 16, r: 15, score: 150, color: '#58d83a', fire: 0 },
};

class Enemy {
  constructor(type, o = {}) {
    this.type = type;
    this.spec = ENEMY[type];
    this.hp = this.spec.hp * (Level.hpMul || 1); // tougher in later worlds
    this.r = this.spec.r;
    this.delay = o.delay || 0;
    this.from = o.from || { x: U.rand(40, 380), y: -40 };
    this.slot = o.slot || { x: this.from.x, y: 120 };
    // keep the resting position on-screen at ANY resolution so every enemy is
    // reachable — otherwise a wave can never clear and the level soft-locks
    const _LW = (typeof Game !== 'undefined' && Game.LW) || 420;
    const _LH = (typeof Game !== 'undefined' && Game.LH) || 800;
    this.slot.x = U.clamp(this.slot.x, this.r + 12, _LW - this.r - 12);
    this.slot.y = U.clamp(this.slot.y, this.r + 24, _LH * 0.6);
    this.dur = o.dur || 1.5;
    this.c1 = o.c1 || { x: this.from.x, y: (this.from.y + this.slot.y) / 2 + 80 };
    this.c2 = o.c2 || { x: this.slot.x + (this.from.x < this.slot.x ? -110 : 110), y: this.slot.y - 70 };
    this.t = 0;
    this.bt = 0;
    this.phase = 'entry';
    this.x = this.from.x;
    this.y = this.from.y;
    this.flash = 0;
    this.fireT = U.rand(0.8, this.spec.fire || 1);
    this.diveDelay = o.diveDelay !== undefined ? o.diveDelay : U.rand(1, 3);
    this.sway = o.sway || U.rand(20, 34);
    this.ph = U.rand(U.TAU);
    this.diving = false;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
  }

  update(dt, g) {
    if (this.delay > 0) { this.delay -= dt; return; }
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 1.3);

    if (this.phase === 'entry') {
      const k = Math.min(1, this.t / this.dur);
      const p = U.bezier(this.from, this.c1, this.c2, this.slot, U.outCubic(k));
      this.x = p.x;
      this.y = p.y;
      if (k >= 1) { this.phase = 'live'; this.bt = 0; }
      return;
    }

    this.bt += dt;
    const T = this.type;
    if (T === 'drone' || T === 'sentry') {
      // the formation slowly advances on the player so it never feels static
      this.slot.y = Math.min(this.slot.y + (10 + (Level.tier || 0) * 2.5) * dt, g.LH * 0.58);
      this.x = U.clamp(this.slot.x + Math.sin(this.bt * 1.3 + this.ph) * this.sway, this.r + 6, g.LW - this.r - 6);
      this.y = this.slot.y + Math.sin(this.bt * 0.8 + this.ph * 2) * 9;
      if (this.spec.fire) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.spec.fire * U.rand(0.8, 1.25) * (Level.fireMul || 1) / (g.dda || 1);
          this.shoot(g);
        }
      } else if (Math.random() < dt * 0.05) {
        this.shoot(g, 200);
      }
    } else if (T === 'splitter' || T === 'mite') {
      this.y += (T === 'mite' ? 70 : 46) * dt;
      this.x += Math.sin(this.bt * (T === 'mite' ? 4 : 2) + this.ph) * (T === 'mite' ? 80 : 50) * dt;
      if (this.y > g.LH + 40) this.dead = true;
    } else if (T === 'diver') {
      if (this.bt < this.diveDelay) {
        this.x = U.clamp(this.slot.x + Math.sin(this.bt * 2 + this.ph) * 12, this.r + 6, g.LW - this.r - 6);
        this.y = this.slot.y;
      } else {
        if (!this.diving) {
          this.diving = true;
          const a = U.angTo(this.x, this.y, g.player.x, g.player.y);
          this.vx = Math.cos(a) * 380;
          this.vy = Math.sin(a) * 380;
          Sfx.whoosh();
        }
        // home gently until close to the player's row, then commit (dodgeable)
        if (this.y < g.player.y - 60) {
          const want = U.angTo(this.x, this.y, g.player.x, g.player.y);
          const cur = Math.atan2(this.vy, this.vx);
          let da = want - cur;
          while (da > Math.PI) da -= U.TAU;
          while (da < -Math.PI) da += U.TAU;
          const na = cur + U.clamp(da, -1.4 * dt, 1.4 * dt);
          this.vx = Math.cos(na) * 380;
          this.vy = Math.sin(na) * 380;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        Particles.spawn({
          x: this.x - this.vx * 0.03, y: this.y - this.vy * 0.03,
          vx: U.rand(-15, 15), vy: U.rand(-15, 15),
          color: '#8aff3a', type: 'flame', size: 2.5, life: 0.22, glow: 8, drag: 1,
        });
        if (this.y > g.LH + 40 || this.x < -40 || this.x > g.LW + 40) this.dead = true;
      }
    }
  }

  shoot(g, speed = 240) {
    speed *= (Level.spdMul || 1) * (0.85 + 0.25 * (g.dda || 1)); // world + adaptive difficulty
    const a = U.angTo(this.x, this.y, g.player.x, g.player.y);
    g.ebullets.push({
      x: this.x, y: this.y + 8,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: 5, type: this.type === 'sentry' ? 'orb2' : 'orb', dead: false,
    });
    Sfx.enemyShoot();
  }

  damage(d, g) {
    if (this.dead) return;
    this.hp -= d;
    this.flash = 0.09;
    this.hitPop = 0.18; // squash-pop reaction
    if (this.hp <= 0) {
      this.dead = true;
      g.killEnemy(this);
    } else {
      Sfx.hit();
    }
  }

  draw(ctx, g) {
    if (this.delay > 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    // depth cue: things higher up the playfield sit further away
    const ds = 0.86 + 0.24 * U.clamp(this.y / g.LH, 0, 1);
    ctx.scale(ds, ds);
    if (this.hitPop) ctx.scale(1 + this.hitPop * 0.5, 1 - this.hitPop * 0.35); // squash-pop on hit
    U.dropShadow(ctx, this.r, 4, this.r * 0.75 + 4, 0.34);
    if (this.type === 'diver' && this.diving) {
      ctx.rotate(Math.atan2(this.vy, this.vx) - Math.PI / 2);
    }
    drawEnemyShape(ctx, this, g.time, this.flash > 0);
    ctx.restore();
  }
}

/* gradients here live in fixed local coordinates, so build each once and
   reuse it every frame for every enemy */
const GRADS = {};
function cgrad(ctx, key, make) {
  return GRADS[key] || (GRADS[key] = make());
}

function googly(ctx, x, y, r, px, py) {
  // shaded eyeball dome with a wet glint
  ctx.fillStyle = cgrad(ctx, `eye${x}|${y}|${r}`, () => {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.65, '#ece6da');
    g.addColorStop(1, '#a89e8a');
    return g;
  });
  ctx.beginPath();
  ctx.arc(x, y, r, 0, U.TAU);
  ctx.fill();
  ctx.fillStyle = '#140a10';
  ctx.beginPath();
  ctx.arc(x + px, y + py, r * 0.45, 0, U.TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x + px - r * 0.18, y + py - r * 0.2, r * 0.16, 0, U.TAU);
  ctx.fill();
}

function drawEnemyShape(ctx, e, t, flash) {
  // painted per-world enemy sprite (mite reuses the world's splitter, smaller)
  const wd = WORLDS[Level.worldIdx];
  const role = e.type === 'mite' ? 'splitter' : e.type;
  const key = wd && wd.enemies ? wd.enemies[role] : null;
  const sc = e.type === 'mite' ? 0.58 : 1;
  if (key && SPR.local(ctx, key, t + e.ph, sc)) {
    if (flash) SPR.flash(ctx, key, sc);
    return;
  }
  const c = e.spec.color;
  ctx.shadowColor = c;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.3;
  const wt = t * 2 + e.ph;

  if (e.type === 'drone') {
    // flying donut: shaded torus with a frosting cap
    ctx.rotate(Math.sin(wt * 1.5) * 0.12);
    ctx.fillStyle = cgrad(ctx, 'dough', () => {
      const g = ctx.createRadialGradient(-4.5, -5.5, 1, 0, 0, 15);
      g.addColorStop(0, '#f4c280');
      g.addColorStop(0.55, '#cd8c42');
      g.addColorStop(1, '#7e4c1c');
      return g;
    });
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, U.TAU);
    ctx.fill();
    // frosting thickness: dark lip first, lit cap on top
    ctx.fillStyle = '#b03a82';
    blobPath(ctx, 12.2, wt * 0.7, 0.06);
    ctx.fill();
    ctx.save();
    ctx.translate(-0.6, -1.4);
    ctx.fillStyle = cgrad(ctx, 'frost', () => {
      const g = ctx.createLinearGradient(-9, -11, 8, 9);
      g.addColorStop(0, '#ffaae2');
      g.addColorStop(0.55, '#ff7ad1');
      g.addColorStop(1, '#d8559e');
      return g;
    });
    blobPath(ctx, 12.2, wt * 0.7, 0.06);
    ctx.fill();
    ctx.restore();
    // hole with inner shadow, lit on its lower lip
    ctx.fillStyle = cgrad(ctx, 'hole', () => {
      const g = ctx.createRadialGradient(0, 1.5, 0.5, 0, 1.5, 5);
      g.addColorStop(0, '#0c0510');
      g.addColorStop(0.75, '#1e0c1a');
      g.addColorStop(1, '#552a48');
      return g;
    });
    ctx.beginPath();
    ctx.arc(0, 1.5, 4.4, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 1.5, 4.4, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // wet sheen on the frosting
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-5, -7, 4.4, 2, -0.6, 0, U.TAU);
    ctx.fill();
    const SPRINK = ['#fff45e', '#7df9ff', '#b7ff2e', '#ffffff', '#ffd02e', '#9e7aff'];
    for (let i = 0; i < 6; i++) {
      const a = e.ph + i * 1.05;
      ctx.save();
      ctx.translate(Math.cos(a) * 8 - 0.6, Math.sin(a) * 7.4 - 1.4);
      ctx.rotate(a + i);
      ctx.fillStyle = 'rgba(60,10,50,0.5)';
      ctx.fillRect(-2.2, -0.3, 4.4, 1.6);
      ctx.fillStyle = SPRINK[i];
      ctx.fillRect(-2.2, -0.8, 4.4, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-1.8, -0.6, 3.6, 0.5);
      ctx.restore();
    }
    googly(ctx, -5, -7, 2.8, Math.sin(wt) * 0.9, 1);
    googly(ctx, 5, -7, 2.8, Math.sin(wt + 1) * 0.9, 1);
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, U.TAU);
      ctx.fill();
    }
  } else if (e.type === 'sentry') {
    // toilet alien: tank up top, hungry bowl below
    const body = () => {
      ctx.beginPath();
      ctx.roundRect(-13, -19, 26, 13, 3);
      ctx.ellipse(0, 3, 15, 11, 0, 0, U.TAU);
    };
    // porcelain lit from the upper left, falling into shade right + below
    body();
    ctx.fillStyle = cgrad(ctx, 'porc', () => {
      const g = ctx.createLinearGradient(-12, -19, 10, 14);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, '#d8e6ee');
      g.addColorStop(1, '#8aa2b2');
      return g;
    });
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,200,0.9)';
    ctx.stroke();
    // tank lid: lighter top face for boxy depth
    ctx.fillStyle = '#fbffff';
    ctx.beginPath();
    ctx.roundRect(-13.6, -20.4, 27.2, 4.4, 2);
    ctx.fill();
    // specular streak down the tank
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-10, -15, 2.2, 8);
    // seat ring + dark bowl mouth with a charging loogie
    ctx.shadowBlur = 4;
    ctx.strokeStyle = cgrad(ctx, 'ring', () => {
      const g = ctx.createLinearGradient(0, -5, 0, 9);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#9ab2c0');
      return g;
    });
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 2, 10.5, 6.5, 0, 0, U.TAU);
    ctx.stroke();
    // bowl interior with depth: walls catch a little light
    ctx.fillStyle = cgrad(ctx, 'bowlin', () => {
      const g = ctx.createRadialGradient(0, 2, 1, 0, 2, 8.5);
      g.addColorStop(0, '#0a0604');
      g.addColorStop(0.7, '#1c1208');
      g.addColorStop(1, '#3c2c16');
      return g;
    });
    ctx.beginPath();
    ctx.ellipse(0, 2, 8.4, 4.8, 0, 0, U.TAU);
    ctx.fill();
    const charge = e.fireT < 0.4 ? 1 : 0.45 + Math.sin(t * 4 + e.ph) * 0.15;
    const rg = ctx.createRadialGradient(0, 2, 0, 0, 2, 7);
    rg.addColorStop(0, `rgba(220,255,160,${charge})`);
    rg.addColorStop(0.5, `rgba(138,255,58,${charge * 0.8})`);
    rg.addColorStop(1, 'rgba(138,255,58,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(0, 2, 7, 4.4, 0, 0, U.TAU);
    ctx.fill();
    // flush lever + grumpy eyes on the tank
    ctx.fillStyle = '#8a9aa8';
    ctx.fillRect(-11, -16, 4, 2);
    ctx.shadowBlur = 0;
    googly(ctx, -5, -12, 2.6, 0, 1.1);
    googly(ctx, 5, -12, 2.6, 0, 1.1);
    ctx.strokeStyle = '#5a6e7a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8.5, -16.5); ctx.lineTo(-2.5, -14);
    ctx.moveTo(8.5, -16.5); ctx.lineTo(2.5, -14);
    ctx.stroke();
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      body();
      ctx.fill();
    }
  } else if (e.type === 'splitter' || e.type === 'mite') {
    // snot blob (and its booger children): jiggly shaded sphere
    const r = e.type === 'mite' ? 8.5 : 15;
    blobPath(ctx, r, wt * 1.6, 0.14);
    ctx.fillStyle = cgrad(ctx, 'blob' + r, () => {
      const g = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.12, 0, 0, r * 1.15);
      g.addColorStop(0, '#e8ffae');
      g.addColorStop(0.45, '#8ad438');
      g.addColorStop(1, '#2e6812');
      return g;
    });
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    // subsurface bounce light along the underside
    ctx.strokeStyle = 'rgba(216,255,150,0.5)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0.5, Math.PI - 0.5);
    ctx.stroke();
    // slimy gloss + dangling drip
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.46, r * 0.3, r * 0.15, -0.5, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = cgrad(ctx, 'drip' + r, () => {
      const g = ctx.createRadialGradient(r * 0.2, r, 0.3, r * 0.25, r + 1, 3);
      g.addColorStop(0, '#c4f47e');
      g.addColorStop(1, '#4e9e1e');
      return g;
    });
    ctx.beginPath();
    ctx.ellipse(r * 0.25, r + Math.sin(wt * 3) * 1.5, 1.6, 2.8, 0, 0, U.TAU);
    ctx.fill();
    if (e.type === 'mite') {
      googly(ctx, 0, -1, 3.4, Math.sin(wt * 2) * 1.1, 0.6);
    } else {
      googly(ctx, -4.5, -3, 3.6, Math.sin(wt * 2) * 1.1, 0.8);
      googly(ctx, 5.5, -5, 2.6, Math.cos(wt * 2) * 0.9, 0.8);
    }
    if (flash) {
      blobPath(ctx, r, wt * 1.6, 0.14);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  } else {
    // zombie pickle, very upset: shaded like a cylinder
    const body = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 14, 0, 0, U.TAU);
    };
    body();
    ctx.fillStyle = cgrad(ctx, 'pickle', () => {
      const g = ctx.createLinearGradient(-7, 0, 7, 0);
      g.addColorStop(0, '#2a6414');
      g.addColorStop(0.3, '#8ae856');
      g.addColorStop(0.55, '#54b830');
      g.addColorStop(1, '#1e4a0e');
      return g;
    });
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // end-cap shading top and bottom
    ctx.fillStyle = 'rgba(14,40,8,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 6, 3.4, 0, 0, U.TAU);
    ctx.fill();
    // specular stripe down the lit flank
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-3.2, -2, 1.1, 9, 0.08, 0, U.TAU);
    ctx.fill();
    // warty bumps with their own little highlights
    for (let i = 0; i < 5; i++) {
      const a = e.ph * 2 + i * 2.4;
      const bx = Math.sin(a) * 4.5, by = ((i / 4) - 0.5) * 20;
      ctx.fillStyle = 'rgba(30,90,14,0.8)';
      ctx.beginPath();
      ctx.arc(bx, by, 1.1, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,255,180,0.5)';
      ctx.beginPath();
      ctx.arc(bx - 0.4, by - 0.4, 0.4, 0, U.TAU);
      ctx.fill();
    }
    // angry eyes + stitched zigzag mouth
    googly(ctx, -3, -6, 2.4, 0, 1);
    googly(ctx, 3, -6, 2.4, 0, 1);
    ctx.strokeStyle = '#1e4a0e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-5, -9.5); ctx.lineTo(-1, -7.5);
    ctx.moveTo(5, -9.5); ctx.lineTo(1, -7.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 1);
    for (let i = 0; i < 4; i++) ctx.lineTo(-4 + (i + 1) * 2, 1 + (i % 2 ? 0 : 2));
    ctx.stroke();
    if (flash) {
      body();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

/* Per-world boss personalities: glow colour, HP scale, the ordered set of
   special attack patterns it cycles through, how aggressively it spawns diving
   minions, and whether it uses the sweeping beam. */
const BOSS_CFG = [
  { glow: '#ff7ad1', hp: 1.00, beam: false, spawn: 0, patterns: ['ring', 'aimed3'] },               // 1 candy
  { glow: '#9bd84a', hp: 1.05, beam: false, spawn: 2, patterns: ['aimed5', 'lob', 'spawn'] },        // 2 trash
  { glow: '#e0b257', hp: 1.10, beam: false, spawn: 1, patterns: ['sweep', 'fan', 'sweep'] },          // 3 desert
  { glow: '#9ee36b', hp: 1.12, beam: true,  spawn: 0, patterns: ['spiral', 'aimed3', 'beam'] },        // 4 toilet
  { glow: '#8fe6ff', hp: 1.20, beam: true,  spawn: 0, patterns: ['ice', 'fan', 'beam'] },              // 5 freezer
  { glow: '#b6ff5a', hp: 1.22, beam: true,  spawn: 2, patterns: ['aimed5', 'spawn', 'spiral', 'beam'] }, // 6 graveyard
  { glow: '#c479ff', hp: 1.35, beam: true,  spawn: 1, patterns: ['spiral', 'ring', 'sweep', 'fan', 'beam'] }, // 7 abyss
];

class Boss {
  constructor(g) {
    this.g = g;
    const tier = Level.tier || 0;
    this.world = Level.worldIdx || 0;
    this.cfg = BOSS_CFG[this.world] || BOSS_CFG[0];
    this.maxHp = Math.round(1350 * (1 + tier * 0.3) * this.cfg.hp); // tougher, scales per world
    this.hp = this.maxHp;
    // hitbox derived from the drawn sprite so the WHOLE boss is hittable
    this.hw = 70; this.hh = 110;
    const bk = WORLDS[this.world] && WORLDS[this.world].bossSprite;
    if (bk && SPR.ok(bk)) {
      const bf = FRAMES[bk], fr = frameRects(bk), u = bf.h / fr.refH;
      this.hw = Math.max(48, fr.refW * u * 0.45);
      this.hh = bf.h * 0.44;
    }
    this.x = g.LW / 2;
    this.y = -140;
    this.t = 0;
    this.state = 'enter';
    this.flash = 0;
    this.atkT = 2.0;
    this.beamT = 0;
    this.beamX = 0;
    this.beamState = 0; // 0 idle, 1 telegraph, 2 firing
    this.spawnT = 5;
    this.dying = 0;
    this.dead = false;
    this.dir = 1;
    this.tellT = 0; // >0 while attacking → show the attack frame
    this.hitT = 0;  // throttle for the hurt sound
    this.spiralA = 0; // running angle for spiral patterns
    this.patI = 0;    // which pattern in cfg.patterns comes next
    this.auraP = 0;   // pulse phase for the glow aura
  }

  get phase() { return this.hp > this.maxHp * 0.55 ? 1 : 2; }

  update(dt) {
    const g = this.g;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.tellT = Math.max(0, this.tellT - dt);
    this.hitT = Math.max(0, this.hitT - dt);

    if (this.state === 'enter') {
      this.y = U.lerp(this.y, 168, Math.min(1, dt * 1.4)); // sit lower so the top HUD never covers it
      if (this.y > 166) { this.y = 168; this.state = 'fight'; }
      return;
    }

    if (this.state === 'dying') {
      this.dying += dt;
      this.x += Math.sin(this.t * 30) * 60 * dt;
      if (((this.dying * 8) | 0) !== (((this.dying - dt) * 8) | 0)) {
        Particles.explosion(
          this.x + U.rand(-90, 90), this.y + U.rand(-30, 36),
          U.pick(['#ff7ad1', '#8aff3a', '#c9803a']), U.rand(0.7, 1.3),
        );
        Sfx.boom(U.rand(0.5, 1));
        g.shake(6);
      }
      if (this.dying > 2.2 && !this.dead) {
        this.dead = true;
        Particles.explosion(this.x, this.y, '#ffffff', 3);
        Sfx.boom(2);
        g.shake(26);
        g.hitstop = 0.18;
        U.vibrate([80, 50, 120]);
        g.bossDown();
      }
      return;
    }

    // fight — drift side to side AND close in on the player as HP drops
    this.hitPop = Math.max(0, (this.hitPop || 0) - dt * 2.5);
    const speed = this.phase === 2 ? 130 : 86;
    if (this.beamState !== 2) {
      this.x += this.dir * speed * dt;
      if (this.x > g.LW - 120) { this.x = g.LW - 120; this.dir = -1; }
      if (this.x < 120) { this.x = 120; this.dir = 1; }
    }
    const targetY = Math.min(g.LH * 0.52, 150 + (1 - this.hp / this.maxHp) * 280);
    this.y = U.lerp(this.y, targetY, Math.min(1, dt * 0.5));

    // ambient aura particles so the boss feels alive/powerful
    if (Math.random() < dt * 16) {
      Particles.spawn({
        x: this.x + U.rand(-72, 72), y: this.y + U.rand(-44, 44),
        vx: U.rand(-12, 12), vy: U.rand(-34, -8), color: this.cfg.glow,
        size: U.rand(2, 4.5), life: U.rand(0.4, 0.9), glow: 10, drag: 1,
      });
    }

    this.atkT -= dt;
    if (this.atkT <= 0) this.attack();

    if (this.beamState === 1) {
      this.beamT -= dt;
      if (this.beamT <= 0) { this.beamState = 2; this.beamT = 0.85; Sfx.beamBlast(); g.shake(6); }
    } else if (this.beamState === 2) {
      this.beamT -= dt;
      this.beamX = U.lerp(this.beamX, this.x, Math.min(1, dt * 2));
      if (this.beamT <= 0) this.beamState = 0;
    }

    // steady diver minions (aggressiveness from the boss config)
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = (this.phase === 2 ? 5 : 8) - this.cfg.spawn;
      this.spawnDivers(1 + this.cfg.spawn);
    }
  }

  spawnDivers(n) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      g.enemies.push(new Enemy('diver', {
        from: { x: this.x + s * 60, y: this.y + 24 },
        slot: { x: U.clamp(this.x + s * (40 + i * 28), 60, g.LW - 60), y: this.y + 70 },
        dur: 0.8, diveDelay: U.rand(0.15, 0.6),
      }));
    }
  }

  attack() {
    const p = this.phase;
    this.tellT = 0.5; // show the attack/charge frame briefly
    this.atkT = (p === 2 ? U.rand(1.0, 1.7) : U.rand(1.5, 2.2)) * (1 - Math.min(0.45, (Level.tier || 0) * 0.06)); // faster per world
    const pats = this.cfg.patterns;
    let pat = pats[this.patI % pats.length];
    this.patI++;
    if (pat === 'beam') {
      if (p === 2 && this.cfg.beam && this.beamState === 0) {
        this.beamState = 1; this.beamT = 1.0; this.beamX = this.x; Sfx.warnTone(); return;
      }
      pat = 'fan'; // beam not ready yet → fall back to a spread
    }
    this.firePattern(pat, p);
  }

  // distinct bullet patterns; each boss cycles its own subset (see BOSS_CFG)
  firePattern(pat, p) {
    const g = this.g, sp = (Level.spdMul || 1), tier = Level.tier || 0;
    const bx = this.x, by = this.y + 30;
    const shoot = (ang, speed, r, type) => g.ebullets.push({ x: bx, y: by, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: r || 5, type: type || 'orb', dead: false });
    const toP = U.angTo(bx, by, g.player.x, g.player.y);
    if (pat === 'aimed3') { for (let i = 0; i < 3; i++) shoot(toP + (i - 1) * 0.10, 300 * sp, 6, 'orb'); Sfx.enemyShoot(); }
    else if (pat === 'aimed5') { const n = 5 + (tier > 3 ? 2 : 0); for (let i = 0; i < n; i++) shoot(toP + (i - (n - 1) / 2) * 0.12, 295 * sp, 6, 'orb'); Sfx.enemyShoot(); }
    else if (pat === 'fan') { const n = (p === 2 ? 15 : 11) + tier; for (let i = 0; i < n; i++) shoot(Math.PI / 2 + (i - (n - 1) / 2) * 0.19, 215 * sp, 5, 'orb2'); Sfx.enemyShoot(); }
    else if (pat === 'ring') { const n = (p === 2 ? 22 : 16) + tier * 2; for (let i = 0; i < n; i++) shoot((i / n) * U.TAU, 185 * sp, 5, 'orb'); Sfx.boom(0.45); }
    else if (pat === 'spiral') { for (let k = 0; k < 3; k++) { this.spiralA += 0.55; for (let arm = 0; arm < 3; arm++) shoot(this.spiralA + arm * (U.TAU / 3), 235 * sp, 5, 'orb'); } Sfx.enemyShoot(); }
    else if (pat === 'ice') { for (let i = 0; i < 4; i++) shoot(toP + (i - 1.5) * 0.16, 155 * sp, 9, 'orb2'); Sfx.boom(0.45); }
    else if (pat === 'lob') { for (let i = 0; i < 6; i++) shoot(Math.PI / 2 + (i - 2.5) * 0.17, 165 * sp, 6, 'orb'); Sfx.enemyShoot(); }
    else if (pat === 'spawn') { this.spawnDivers(3); Sfx.whoosh(); }
    else if (pat === 'sweep') {
      const n = 13, gap = 1 + ((Math.random() * (n - 3)) | 0);
      for (let i = 0; i < n; i++) {
        if (i === gap || i === gap + 1) continue; // a dodge gap
        g.ebullets.push({ x: 40 + i * (g.LW - 80) / (n - 1), y: this.y, vx: 0, vy: 205 * sp, r: 5, type: 'orb2', dead: false });
      }
      Sfx.enemyShoot();
    } else { for (let i = 0; i < 3; i++) shoot(toP + (i - 1) * 0.1, 290 * sp, 6, 'orb'); Sfx.enemyShoot(); }
  }

  hitTest(x, y, r) {
    if (this.state !== 'fight') return false;
    const dx = (x - this.x) / (this.hw + r);
    const dy = (y - this.y) / (this.hh + r);
    return dx * dx + dy * dy < 1; // ellipse matching the drawn boss
  }

  damage(d, g) {
    if (this.state !== 'fight') return;
    this.hp -= d;
    this.flash = 0.16; // visible hurt flash
    this.hitPop = 0.12; // squash-pop reaction
    if (this.hitT <= 0) { Sfx.hit(); this.hitT = 0.06; } // throttled hurt sound
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.dying = 0;
      this.beamState = 0;
      g.ebullets.length = 0;
      g.hitstop = 0.12;
      g.shake(10);
    }
  }

  draw(ctx) {
    const g = this.g, t = this.t;
    ctx.save();
    ctx.translate(this.x, this.y);
    U.dropShadow(ctx, 70, 10, 48, 0.4);
    if (this.state === 'dying') {
      ctx.rotate(Math.sin(t * 14) * 0.04);
      ctx.globalAlpha = 0.85 + Math.sin(t * 40) * 0.15;
    }

    // painted per-world boss sprite — idle loops the calm frames; the last frame
    // is the attack/charge tell, shown only while actually attacking or dying
    const bKey = WORLDS[Level.worldIdx] && WORLDS[Level.worldIdx].bossSprite;
    if (bKey && SPR.ok(bKey)) {
      // pulsing glow aura behind the boss
      const aura = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + 0.16 * aura;
      const ag = ctx.createRadialGradient(0, 0, 20, 0, 0, 165);
      ag.addColorStop(0, this.cfg.glow);
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, 4, 165, 0, U.TAU); ctx.fill();
      ctx.restore();

      if (this.hitPop) ctx.scale(1 + this.hitPop * 0.35, 1 - this.hitPop * 0.22); // hit pop
      const n = (FRAMES[bKey] && FRAMES[bKey].n) || 8;
      let bi;
      if (this.state === 'dying') bi = n - 1;
      else if (this.beamState > 0 || this.tellT > 0) bi = n - 1;
      else bi = Math.floor(t * 6) % Math.max(1, n - 1);
      SPR.frameAt(ctx, bKey, bi);

      if (this.flash > 0) { // bright white→red hurt flash over the boss
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.85, this.flash * 5);
        const fg = ctx.createRadialGradient(0, 0, 8, 0, 0, 130);
        fg.addColorStop(0, 'rgba(255,255,255,0.95)');
        fg.addColorStop(0.5, 'rgba(255,120,120,0.5)');
        fg.addColorStop(1, 'rgba(255,80,80,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(0, 0, 130, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      this.drawBeam(ctx);
      return;
    }

    const tankPath = () => {
      ctx.beginPath();
      ctx.roundRect(-58, -64, 116, 44, 8);
    };
    const bowlPath = () => {
      ctx.beginPath();
      ctx.ellipse(0, 10, 64, 34, 0, 0, U.TAU);
    };

    // slimy tentacle arms, waving plungers — dark core + lit ridge = cylinders
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const wave = Math.sin(t * 2.4 + i * 1.8 + s) * 12;
        ctx.shadowColor = '#8aff3a';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#2e6212';
        ctx.lineWidth = 7 - i * 1.5;
        ctx.beginPath();
        ctx.moveTo(s * 40, 4 - i * 6);
        ctx.quadraticCurveTo(s * (66 + i * 8), -18 + wave, s * (88 + i * 6), -2 + wave + i * 10);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#7ade4a';
        ctx.lineWidth = (7 - i * 1.5) * 0.45;
        ctx.beginPath();
        ctx.moveTo(s * 40, 2.6 - i * 6);
        ctx.quadraticCurveTo(s * (66 + i * 8), -19.4 + wave, s * (88 + i * 6), -3.4 + wave + i * 10);
        ctx.stroke();
      }
      // plunger in the middle tentacle's grip
      const wave = Math.sin(t * 2.4 + 1.8 + s) * 12;
      const px2 = s * 94, py2 = wave + 8;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#b8884a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px2, py2 - 16);
      ctx.lineTo(px2, py2);
      ctx.stroke();
      ctx.fillStyle = '#c83a3a';
      ctx.beginPath();
      ctx.ellipse(px2, py2 + 3, 9, 6, 0, Math.PI, 0, false);
      ctx.fill();
    }

    // porcelain tank with crown — lit upper-left, shaded lower-right
    const pg = ctx.createLinearGradient(-50, -64, 40, 44);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.5, '#d4e2ea');
    pg.addColorStop(1, '#8aa2b2');
    ctx.shadowColor = '#bfe8ff';
    ctx.shadowBlur = 7;
    tankPath();
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,200,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // tank lid: a lighter top face
    ctx.fillStyle = '#feffff';
    ctx.beginPath();
    ctx.roundRect(-61, -67, 122, 9, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,200,0.7)';
    ctx.stroke();
    // long specular streak
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.roundRect(-48, -56, 7, 30, 3.5);
    ctx.fill();

    // crown: each spike faceted light/dark down the middle
    for (let i = 0; i < 5; i++) {
      const x0 = -30 + i * 15, xm = x0 + 7.5, x1 = x0 + 15;
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.moveTo(x0, -67);
      ctx.lineTo(xm, -85);
      ctx.lineTo(xm, -67);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#cf9a2c';
      ctx.beginPath();
      ctx.moveTo(xm, -85);
      ctx.lineTo(x1, -67);
      ctx.lineTo(xm, -67);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#8a6a1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-30, -67);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(-30 + i * 15 + 7.5, -85);
      ctx.lineTo(-30 + (i + 1) * 15, -67);
    }
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const jx = -30 + i * 15 + 7.5;
      const jg = ctx.createRadialGradient(jx - 0.6, -77.6, 0.2, jx, -77, 2);
      jg.addColorStop(0, '#ff9ed0');
      jg.addColorStop(1, '#a02468');
      ctx.fillStyle = jg;
      ctx.beginPath();
      ctx.arc(jx, -77, 1.8, 0, U.TAU);
      ctx.fill();
    }

    // furious eyes on the tank, tracking the player
    const lookX = U.clamp((g.player.x - this.x) / 60, -3, 3);
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(s * 24, -44, 11, 8, 0, 0, U.TAU);
      ctx.fill();
      const red = this.phase === 2 ? '#ff2e2e' : '#c81e50';
      ctx.fillStyle = red;
      ctx.shadowColor = red;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s * 24 + lookX, -43, 4, 0, U.TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0608';
      ctx.beginPath();
      ctx.arc(s * 24 + lookX, -43, 1.8, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = '#4a5a64';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s * 34, -55);
      ctx.lineTo(s * 12, -48);
      ctx.stroke();
    }
    // flush lever
    ctx.fillStyle = '#8a9aa8';
    ctx.fillRect(-52, -58, 10, 4);

    // the bowl: hemisphere with its own lighting
    ctx.shadowColor = '#bfe8ff';
    ctx.shadowBlur = 7;
    const bg2 = ctx.createRadialGradient(-22, -4, 4, 0, 12, 78);
    bg2.addColorStop(0, '#ffffff');
    bg2.addColorStop(0.5, '#cddde6');
    bg2.addColorStop(1, '#7e96a6');
    bowlPath();
    ctx.fillStyle = bg2;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,150,175,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // seat ring with thickness: shaded ring + bright top arc
    const ring2 = ctx.createLinearGradient(0, -15, 0, 27);
    ring2.addColorStop(0, '#ffffff');
    ring2.addColorStop(1, '#94acba');
    ctx.strokeStyle = ring2;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 6, 46, 21, 0, 0, U.TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 4.4, 46, 21, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    // grime drips down the porcelain
    ctx.fillStyle = 'rgba(110,200,46,0.75)';
    for (const [dx, dl] of [[-34, 10], [-10, 16], [16, 8], [38, 13]]) {
      ctx.beginPath();
      ctx.ellipse(dx, 26 + dl / 2 + Math.sin(t * 2 + dx) * 1.5, 2.2, dl / 2 + 3, 0, 0, U.TAU);
      ctx.fill();
    }

    // swirling sewage weak point inside the bowl
    const ph2 = this.phase === 2;
    const core = ph2 ? '#ff8a3d' : '#8aff3a';
    const pulse = 0.6 + Math.sin(t * (ph2 ? 9 : 5)) * 0.3;
    // bowl mouth falls away into darkness, walls catching light at the rim
    const mouth = ctx.createRadialGradient(0, 5, 2, 0, 5, 38);
    mouth.addColorStop(0, '#060302');
    mouth.addColorStop(0.72, '#180f06');
    mouth.addColorStop(1, '#46341a');
    ctx.fillStyle = mouth;
    ctx.beginPath();
    ctx.ellipse(0, 5, 38, 16, 0, 0, U.TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 5, 38, 16, 0, 0, U.TAU);
    ctx.clip();
    ctx.translate(0, 5);
    ctx.scale(1, 0.42);
    ctx.rotate(t * 2.2);
    ctx.strokeStyle = core;
    ctx.shadowColor = core;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 12 + i * 8, (i * U.TAU) / 4, (i * U.TAU) / 4 + 2.4);
      ctx.stroke();
    }
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    cg.addColorStop(0, `rgba(255,255,255,${pulse})`);
    cg.addColorStop(0.6, core);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    if (this.flash > 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      tankPath();
      ctx.fill();
      bowlPath();
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    this.drawBeam(ctx);
  }

  drawBeam(ctx) {
    const g = this.g;
    // telegraphed sewage geyser (world coords)
    if (this.beamState === 1) {
      if (Math.sin(g.time * 30) > 0) {
        ctx.strokeStyle = 'rgba(140,230,46,0.55)';
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.beamX, this.y + 44);
        ctx.lineTo(this.beamX, g.LH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (this.beamState === 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const w = 26 + Math.sin(g.time * 50) * 4;
      const bg = ctx.createLinearGradient(this.beamX - w, 0, this.beamX + w, 0);
      bg.addColorStop(0, 'rgba(140,230,46,0)');
      bg.addColorStop(0.5, 'rgba(150,230,60,0.55)');
      bg.addColorStop(1, 'rgba(140,230,46,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(this.beamX - w, this.y + 36, w * 2, g.LH - this.y);
      ctx.fillStyle = 'rgba(240,255,210,0.85)';
      ctx.shadowColor = '#8aff3a';
      ctx.shadowBlur = 18;
      ctx.fillRect(this.beamX - 4, this.y + 36, 8, g.LH - this.y);
      ctx.restore();
      if (Math.random() < 0.5) {
        Particles.spawn({
          x: this.beamX + U.rand(-10, 10), y: g.LH - 6,
          vx: U.rand(-120, 120), vy: U.rand(-220, -60),
          color: '#8aff3a', size: 2.5, life: 0.4, glow: 10,
        });
      }
    }
  }
}

/* The 7 gross worlds. Each has its own video background, static fallback image,
   music track and boss name. Enemy choreography is shared (Level.build) but
   scaled up per world for rising difficulty. Missing assets degrade gracefully:
   no video → static image → procedural; missing music simply stays silent. */
const WORLDS = [
  { name: 'ROTTEN CANDY CAROUSEL', sub: 'the donuts smell you already',
    video: 'level1_bg.mp4',     fallback: 'worlds/world1.jpg', music: 'audio/lvl1.mp3',  boss: 'KING CAVITY CAROUSEL',
    bossSprite: 'king_cavity',
    enemies: { drone: 'wrapper_wasp', sentry: 'lollipop_leech', splitter: 'gummy_goblin', diver: 'sour_blob_pop' } },
  { name: 'TRASH MOON BUFFET',    sub: 'leftovers that learned to bite back',
    video: 'worlds/world2.mp4', fallback: 'worlds/world2.jpg',            music: 'audio/world2.mp3', boss: 'BUFFET DUMPSTER SUPREME',
    bossSprite: 'buffet_dumpster',
    enemies: { drone: 'trash_bag_bat', sentry: 'rotten_broccoli', splitter: 'moldy_meatball', diver: 'pizza_crab' } },
  { name: 'DIRTY DESERT WORLD',   sub: 'sand, dust and regret',
    video: 'worlds/world3.mp4', fallback: 'worlds/world3.jpg',            music: 'audio/world3.mp3', boss: 'BARON DUSTGUT',
    bossSprite: 'baron_dustgut',
    enemies: { drone: 'dust_bunny', sentry: 'cactus_crumb', splitter: 'sandbag_slug', diver: 'vacuum_fossil' } },
  { name: 'TOILET ORBIT',         sub: 'you really came all this way for this',
    video: 'worlds/world4.mp4', fallback: 'worlds/world4.jpg',            music: 'audio/world4.mp3', boss: 'GRAND FLUSH ABOMINATION',
    bossSprite: 'grand_flush',
    enemies: { drone: 'plunger_parasite', sentry: 'urinal_cake', splitter: 'hair_clog', diver: 'tp_mummy' } },
  { name: 'FREEZER BURN SECTOR',  sub: 'expired in 2009, still furious',
    video: 'worlds/world5.mp4', fallback: 'worlds/world5.jpg',            music: 'audio/world5.mp3', boss: 'FREEZER BURN BEHEMOTH',
    bossSprite: 'freezer_behemoth',
    enemies: { drone: 'frozen_pea', sentry: 'tv_dinner', splitter: 'ice_cream', diver: 'fish_stick' } },
  { name: 'GRAVEYARD MEAT MOON',  sub: 'the worms remember your face',
    video: 'worlds/world6.mp4', fallback: 'worlds/world6.jpg',            music: 'audio/world6.mp3', boss: 'MEAT MOON NECRO-MAW',
    bossSprite: 'meat_necro',
    enemies: { drone: 'bone_bat', sentry: 'tombstone_toad', splitter: 'worm_rider', diver: 'zombie_hand' } },
  { name: 'THE ABYSS',            sub: 'there is no bottom, only gross',
    video: 'worlds/world7.mp4', fallback: 'worlds/world7.jpg',            music: 'audio/world7.mp3', boss: 'THE GROSS SINGULARITY',
    bossSprite: 'gross_singularity', ending: 'worlds/ending.mp4',
    enemies: { drone: 'reality_roach', sentry: 'condiment_demon', splitter: 'void_pickle', diver: 'sock_madness' } },
  // NOTE: static fallback PNGs for worlds 2-7 not yet supplied (worlds without a
  // video fall back to the procedural background until those images arrive).
];

/* ---- wave formation helpers — each returns an array of timed spawn entries.
   'type' is the BEHAVIOUR role (drone/sentry/splitter/diver); the sprite shown
   is chosen per world in drawEnemyShape, so the same formation reads differently
   in each world. Mixing these in varied orders is what keeps levels from
   feeling identical. ---- */
function fSwoop(g, n, type) {
  const LW = g.LW, cx = LW / 2, out = [];
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    out.push({ d: i * 0.17, e: () => new Enemy(type, {
      from: { x: s < 0 ? -36 : LW + 36, y: 130 },
      c1: { x: cx, y: 300 }, c2: { x: cx - s * 110, y: 60 },
      slot: { x: cx + s * (34 + (i >> 1) * 40), y: 110 + (i % 3) * 30 }, dur: 1.8,
    }) });
  }
  return out;
}
function fGrid(g, cols, rows, type) {
  const LW = g.LW, cx = LW / 2, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const sx = cx + (c - (cols - 1) / 2) * 50, sy = 84 + r * 44;
    out.push({ d: (r * cols + c) * 0.07, e: () => new Enemy(type, {
      from: { x: sx > cx ? LW + 40 : -40, y: -20 }, slot: { x: sx, y: sy }, dur: 1.5, sway: 24,
    }) });
  }
  return out;
}
function fSentry(g, n, type) {
  const LW = g.LW, out = [];
  for (let i = 0; i < n; i++) out.push({ d: i * 0.3, e: () => new Enemy(type, {
    from: { x: 40 + i * 40, y: -50 }, slot: { x: 56 + i * (LW - 112) / Math.max(1, n - 1), y: 96 }, dur: 1.5,
  }) });
  return out;
}
function fSplit(g, n, type) {
  const LW = g.LW, out = [];
  for (let i = 0; i < n; i++) out.push({ d: 0.3 + i * 0.55, e: () => new Enemy(type, {
    from: { x: U.rand(50, LW - 50), y: -40 }, slot: { x: U.rand(60, LW - 60), y: U.rand(50, 120) }, dur: 1.05,
  }) });
  return out;
}
function fDive(g, n, type, fast) {
  const LW = g.LW, out = [];
  for (let i = 0; i < n; i++) out.push({ d: i * (fast ? 0.3 : 0.42), e: () => new Enemy(type, {
    from: { x: i % 2 ? -30 : LW + 30, y: 38 + (i % 3) * 24 },
    slot: { x: U.rand(60, LW - 60), y: 66 + (i % 3) * 26 }, dur: fast ? 0.85 : 1.05,
    diveDelay: U.rand(0.25, fast ? 0.9 : 1.4),
  }) });
  return out;
}
function fPincer(g, n, type) {
  const LW = g.LW, cx = LW / 2, out = [];
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    out.push({ d: i * 0.15, e: () => new Enemy(type, {
      from: { x: s < 0 ? -36 : LW + 36, y: 90 + (i % 3) * 18 },
      slot: { x: cx + s * (30 + (i >> 1) * 42), y: 118 + (i % 2) * 38 }, dur: 1.6,
    }) });
  }
  return out;
}
function shiftSpawns(arr, dt) { return arr.map(p => ({ d: p.d + dt, e: p.e, gift: p.gift })); }

/* Each world runs a different ordered sequence of formations (its "rhythm"),
   so no two worlds play the same. Gifts drop at fixed beats: a signature weapon
   on wave 2, a utility pickup on wave 4, a power weapon right before the boss. */
const PLANS = [
  ['swoop', 'sentry', 'split', 'grid', 'dive', 'pincer', 'sentry', 'mix'],            // 1 candy
  ['grid', 'pincer', 'split', 'sentry', 'dive', 'grid', 'pincer', 'mix'],             // 2 trash
  ['sentry', 'swoop', 'dive', 'split', 'pincer', 'sentry', 'dive', 'mix'],            // 3 desert
  ['pincer', 'split', 'sentry', 'dive', 'grid', 'split', 'sentry', 'mix', 'mix'],     // 4 toilet
  ['grid', 'dive', 'swoop', 'split', 'sentry', 'dive', 'grid', 'mix', 'mix'],         // 5 freezer
  ['dive', 'split', 'sentry', 'swoop', 'pincer', 'dive', 'sentry', 'mix', 'mix'],     // 6 graveyard
  ['pincer', 'grid', 'dive', 'split', 'sentry', 'mix', 'pincer', 'dive', 'mix', 'mix'], // 7 abyss
];
const WAVE_SUBS = [
  'incoming · wipe them out', 'they brought friends', 'this is the gross part',
  'do not let them land', 'getting worse, huh', 'okay this is just rude',
  'almost there · probably not', 'last push before the big one',
];
const GIFT_SIG = ['scatter', 'missile', 'beam', 'scatter', 'missile', 'beam', 'beam'];
const GIFT_UTIL = ['shield', 'mult', 'repair', 'over', 'shield', 'repair', 'over'];
const GIFT_BIG = ['beam', 'beam', 'missile', 'beam', 'missile', 'beam', 'beam'];

const Level = {
  waves: [], waveIdx: -1, queue: [], betweenT: 0, bossSpawned: false, done: false,
  worldIdx: 0, tier: 0, hpMul: 1, spdMul: 1, fireMul: 1,

  reset(g) { this.loadWorld(g, 0); },

  // (re)configure for a world: difficulty scaling, fresh wave queue, swap bg+music
  loadWorld(g, idx) {
    this.worldIdx = idx;
    this.tier = idx;
    this.hpMul = 1 + idx * 0.24;                    // enemies get tankier
    this.spdMul = 1 + idx * 0.09;                   // shots fly faster
    this.fireMul = Math.max(0.42, 1 - idx * 0.10);  // and come more often
    this.waveIdx = -1;
    this.queue = [];
    this.betweenT = 1.4;
    this.bossSpawned = false;
    this.done = false;
    this.waves = this.build(g);
    g.applyWorld(WORLDS[idx], idx);
  },

  // 0 at the first wave → 1 once the boss arrives; drives the background pan
  progress() {
    if (this.bossSpawned || !this.waves.length) return 1;
    return U.clamp(this.waveIdx / this.waves.length, 0, 1);
  },

  build(g) {
    const idx = this.worldIdx;
    const plan = PLANS[idx] || PLANS[0];
    // narrow (mobile portrait) screens fit fewer enemies and shots travel farther,
    // so pack in more to keep the pressure up
    const mob = g.LW < 620 ? 2 : 0;
    const m = (n) => n + mob;
    const waves = [];
    for (let w = 0; w < plan.length; w++) {
      const t = plan[w];
      const bump = idx + (w >> 1) + mob; // more enemies later, in later worlds, and on mobile
      let parts;
      if (t === 'swoop') parts = fSwoop(g, 8 + bump, 'drone');
      else if (t === 'grid') parts = fGrid(g, Math.min(8, 6 + (idx >> 1)), 2 + (w > 1 ? 1 : 0), 'drone');
      else if (t === 'sentry') parts = fSentry(g, m(3) + (idx >> 1), 'sentry').concat(shiftSpawns(fSwoop(g, 4 + idx, 'drone'), 1.1));
      else if (t === 'split') parts = fSplit(g, m(4) + (bump >> 1), 'splitter');
      else if (t === 'dive') parts = fDive(g, 7 + bump, 'diver', idx >= 3);
      else if (t === 'pincer') parts = fPincer(g, 8 + bump, 'drone');
      else parts = fDive(g, 6 + idx + mob, 'diver', true) // 'mix' — chaos
        .concat(shiftSpawns(fSplit(g, m(3), 'splitter'), 0.6), shiftSpawns(fSentry(g, m(2), 'sentry'), 1.4));
      const list = [];
      if (w === 1) list.push({ d: 0.3, gift: GIFT_SIG[idx] });        // signature weapon
      else if (w === 3) list.push({ d: 0.3, gift: GIFT_UTIL[idx] });  // utility pickup
      if (w === plan.length - 1) list.push({ d: 0.3, gift: GIFT_BIG[idx] }); // power weapon before boss
      for (const p of parts) list.push(p);
      waves.push({ name: 'WAVE ' + (w + 1), sub: WAVE_SUBS[(w + idx) % WAVE_SUBS.length], list });
    }
    return waves;
  },

  update(dt, g) {
    if (this.done) return;

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.d -= dt;
      if (q.d <= 0) {
        if (q.boss) g.spawnBoss();
        else if (q.gift) g.powerups.push(new PowerUp(g.LW / 2, -24, q.gift));
        else g.enemies.push(q.e());
        this.queue.splice(i, 1);
      }
    }

    if (this.queue.length === 0 && g.enemies.length === 0 && !g.boss) {
      this.betweenT -= dt;
      if (this.betweenT <= 0) {
        this.waveIdx++;
        if (this.waveIdx < this.waves.length) {
          const w = this.waves[this.waveIdx];
          g.banner(w.name, w.sub || '');
          this.queue = w.list.map(o => ({ d: o.d + 0.7, e: o.e, gift: o.gift }));
          this.betweenT = 1.6;
        } else if (!this.bossSpawned) {
          this.bossSpawned = true;
          const bk = WORLDS[this.worldIdx].bossSprite;
          if (bk && SPR.ok(bk)) frameRects(bk); // warm the slice now so the boss doesn't hitch on entry
          g.banner('⚠ ' + WORLDS[this.worldIdx].boss + ' ⚠', 'something huge just woke up. it’s mad at you', true);
          Sfx.alarm();
          this.queue = [{ d: 2.2, boss: true }];
        }
      }
    }
  },
};
