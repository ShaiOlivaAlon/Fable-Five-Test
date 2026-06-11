'use strict';

/* drone = flying donut · sentry = toilet alien · splitter = snot blob
   mite = booger · diver = zombie pickle */
const ENEMY = {
  drone:    { hp: 20, r: 14, score: 100, color: '#ff7ad1', fire: 0 },
  sentry:   { hp: 48, r: 17, score: 250, color: '#cfe6f0', fire: 2.4 },
  splitter: { hp: 34, r: 15, score: 200, color: '#8aff3a', fire: 0 },
  mite:     { hp: 10, r: 9,  score: 60,  color: '#8aff3a', fire: 0 },
  diver:    { hp: 16, r: 12, score: 150, color: '#58d83a', fire: 0 },
};

class Enemy {
  constructor(type, o = {}) {
    this.type = type;
    this.spec = ENEMY[type];
    this.hp = this.spec.hp;
    this.r = this.spec.r;
    this.delay = o.delay || 0;
    this.from = o.from || { x: U.rand(40, 380), y: -40 };
    this.slot = o.slot || { x: this.from.x, y: 120 };
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
      this.x = this.slot.x + Math.sin(this.bt * 1.3 + this.ph) * this.sway;
      this.y = this.slot.y + Math.sin(this.bt * 0.8 + this.ph * 2) * 9;
      if (this.spec.fire) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.spec.fire * U.rand(0.8, 1.25);
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
        this.x = this.slot.x + Math.sin(this.bt * 2 + this.ph) * 12;
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
    if (this.type === 'diver' && this.diving) {
      ctx.rotate(Math.atan2(this.vy, this.vx) - Math.PI / 2);
    }
    drawEnemyShape(ctx, this, g.time, this.flash > 0);
    ctx.restore();
  }
}

function googly(ctx, x, y, r, px, py) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, U.TAU);
  ctx.fill();
  ctx.fillStyle = '#140a10';
  ctx.beginPath();
  ctx.arc(x + px, y + py, r * 0.45, 0, U.TAU);
  ctx.fill();
}

function drawEnemyShape(ctx, e, t, flash) {
  const c = e.spec.color;
  ctx.shadowColor = c;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.3;
  const wt = t * 2 + e.ph;

  if (e.type === 'drone') {
    // flying donut
    ctx.rotate(Math.sin(wt * 1.5) * 0.12);
    ctx.fillStyle = '#d8954a';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#ff7ad1';
    blobPath(ctx, 12.2, wt * 0.7, 0.06);
    ctx.fill();
    ctx.fillStyle = '#1a0a18';
    ctx.beginPath();
    ctx.arc(0, 1.5, 4.4, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = '#c84a9e';
    ctx.stroke();
    ctx.shadowBlur = 0;
    const SPRINK = ['#fff45e', '#7df9ff', '#b7ff2e', '#ffffff', '#ffd02e', '#9e7aff'];
    for (let i = 0; i < 6; i++) {
      const a = e.ph + i * 1.05;
      ctx.save();
      ctx.translate(Math.cos(a) * 8, Math.sin(a) * 7.4);
      ctx.rotate(a + i);
      ctx.fillStyle = SPRINK[i];
      ctx.fillRect(-2.2, -0.8, 4.4, 1.6);
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
    const pg = ctx.createLinearGradient(0, -19, 0, 14);
    pg.addColorStop(0, '#f0f8fc');
    pg.addColorStop(1, '#a8bcc8');
    body();
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,200,0.9)';
    ctx.stroke();
    // seat ring + dark bowl mouth with a charging loogie
    ctx.shadowBlur = 4;
    ctx.strokeStyle = '#e8f4f8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 2, 10.5, 6.5, 0, 0, U.TAU);
    ctx.stroke();
    ctx.fillStyle = '#140e08';
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
    // snot blob (and its booger children)
    const r = e.type === 'mite' ? 8.5 : 15;
    const gg = ctx.createLinearGradient(0, -r, 0, r);
    gg.addColorStop(0, '#c8ff6e');
    gg.addColorStop(1, '#4e9e1e');
    blobPath(ctx, r, wt * 1.6, 0.14);
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    // slimy gloss + dangling drip
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.32, r * 0.18, -0.5, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#6ec82e';
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
    // zombie pickle, very upset
    const body = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 14, 0, 0, U.TAU);
    };
    const gg = ctx.createLinearGradient(-7, 0, 7, 0);
    gg.addColorStop(0, '#3e8a22');
    gg.addColorStop(0.5, '#6ed83e');
    gg.addColorStop(1, '#3e8a22');
    body();
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // warty bumps
    ctx.fillStyle = 'rgba(30,90,14,0.8)';
    for (let i = 0; i < 5; i++) {
      const a = e.ph * 2 + i * 2.4;
      ctx.beginPath();
      ctx.arc(Math.sin(a) * 4.5, ((i / 4) - 0.5) * 20, 1.1, 0, U.TAU);
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

class Boss {
  constructor(g) {
    this.g = g;
    this.maxHp = 1500;
    this.hp = this.maxHp;
    this.x = g.LW / 2;
    this.y = -140;
    this.t = 0;
    this.state = 'enter';
    this.flash = 0;
    this.atkT = 2.2;
    this.beamT = 0;
    this.beamX = 0;
    this.beamState = 0; // 0 idle, 1 telegraph, 2 firing
    this.spawnT = 6;
    this.dying = 0;
    this.dead = false;
    this.dir = 1;
  }

  get phase() { return this.hp > this.maxHp * 0.55 ? 1 : 2; }

  update(dt) {
    const g = this.g;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.state === 'enter') {
      this.y = U.lerp(this.y, 130, Math.min(1, dt * 1.4));
      if (this.y > 128) { this.y = 130; this.state = 'fight'; }
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

    // fight
    const speed = this.phase === 2 ? 110 : 70;
    if (this.beamState !== 2) {
      this.x += this.dir * speed * dt;
      if (this.x > g.LW - 125) { this.x = g.LW - 125; this.dir = -1; }
      if (this.x < 125) { this.x = 125; this.dir = 1; }
    }

    this.atkT -= dt;
    if (this.atkT <= 0) this.attack();

    if (this.beamState === 1) {
      this.beamT -= dt;
      if (this.beamT <= 0) {
        this.beamState = 2;
        this.beamT = 0.8;
        Sfx.beamBlast();
        g.shake(5);
      }
    } else if (this.beamState === 2) {
      this.beamT -= dt;
      this.beamX = U.lerp(this.beamX, this.x, Math.min(1, dt * 2));
      if (this.beamT <= 0) this.beamState = 0;
    }

    this.spawnT -= dt;
    if (this.phase === 2 && this.spawnT <= 0) {
      this.spawnT = 9;
      for (const s of [-1, 1]) {
        g.enemies.push(new Enemy('drone', {
          from: { x: this.x + s * 80, y: this.y + 10 },
          slot: { x: U.rand(60, g.LW - 60), y: U.rand(200, 280) },
          dur: 1.3,
        }));
      }
    }
  }

  attack() {
    const g = this.g, p = this.phase;
    const roll = Math.random();
    this.atkT = p === 2 ? U.rand(1.4, 2.2) : U.rand(1.9, 2.6);
    if (p === 2 && this.beamState === 0 && roll < 0.3) {
      this.beamState = 1;
      this.beamT = 0.9;
      this.beamX = this.x;
      Sfx.warnTone();
      return;
    }
    if (roll < 0.55) {
      const a = U.angTo(this.x, this.y + 30, g.player.x, g.player.y);
      for (let i = 0; i < 3; i++) {
        g.ebullets.push({
          x: this.x, y: this.y + 36,
          vx: Math.cos(a + (i - 1) * 0.09) * 290,
          vy: Math.sin(a + (i - 1) * 0.09) * 290,
          r: 6, type: 'orb', dead: false,
        });
      }
      Sfx.enemyShoot();
    } else {
      const n = p === 2 ? 13 : 9;
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22;
        g.ebullets.push({
          x: this.x, y: this.y + 30,
          vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
          r: 5, type: 'orb2', dead: false,
        });
      }
      Sfx.enemyShoot();
    }
  }

  hitTest(x, y, r) {
    if (this.state !== 'fight') return false;
    return (
      U.dist2(x, y, this.x, this.y) < (46 + r) * (46 + r) ||
      U.dist2(x, y, this.x - 78, this.y - 4) < (26 + r) * (26 + r) ||
      U.dist2(x, y, this.x + 78, this.y - 4) < (26 + r) * (26 + r)
    );
  }

  damage(d, g) {
    if (this.state !== 'fight') return;
    this.hp -= d;
    this.flash = 0.06;
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
    if (this.state === 'dying') {
      ctx.rotate(Math.sin(t * 14) * 0.04);
      ctx.globalAlpha = 0.85 + Math.sin(t * 40) * 0.15;
    }

    const tankPath = () => {
      ctx.beginPath();
      ctx.roundRect(-58, -64, 116, 44, 8);
    };
    const bowlPath = () => {
      ctx.beginPath();
      ctx.ellipse(0, 10, 64, 34, 0, 0, U.TAU);
    };

    // slimy tentacle arms, waving plungers
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const wave = Math.sin(t * 2.4 + i * 1.8 + s) * 12;
        ctx.strokeStyle = i === 1 ? '#4e9e1e' : '#58c83a';
        ctx.lineWidth = 7 - i * 1.5;
        ctx.shadowColor = '#8aff3a';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(s * 40, 4 - i * 6);
        ctx.quadraticCurveTo(s * (66 + i * 8), -18 + wave, s * (88 + i * 6), -2 + wave + i * 10);
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

    // porcelain tank with crown
    const pg = ctx.createLinearGradient(0, -64, 0, 44);
    pg.addColorStop(0, '#fdffff');
    pg.addColorStop(0.55, '#d4e2ea');
    pg.addColorStop(1, '#9ab2c0');
    ctx.shadowColor = '#bfe8ff';
    ctx.shadowBlur = 7;
    tankPath();
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,200,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd84d';
    ctx.strokeStyle = '#b8902e';
    ctx.beginPath();
    ctx.moveTo(-30, -64);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(-30 + i * 15 + 7.5, -82);
      ctx.lineTo(-30 + (i + 1) * 15, -64);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c83a8e';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-30 + i * 15 + 7.5, -74, 1.8, 0, U.TAU);
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

    // the bowl
    ctx.shadowColor = '#bfe8ff';
    ctx.shadowBlur = 7;
    bowlPath();
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,150,175,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e8f4f8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 6, 46, 21, 0, 0, U.TAU);
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
    ctx.fillStyle = '#140e06';
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

/* Demo level: 5 choreographed waves, then the Great Toilet Overlord. */
const Level = {
  waves: [], waveIdx: -1, queue: [], betweenT: 0, bossSpawned: false, done: false,

  reset(g) {
    this.waveIdx = -1;
    this.queue = [];
    this.betweenT = 1.2;
    this.bossSpawned = false;
    this.done = false;
    this.waves = this.build(g);
  },

  build(g) {
    const LW = g.LW, cx = LW / 2;
    const waves = [];

    // W1 — mirrored donut swoops
    {
      const list = [];
      for (let i = 0; i < 4; i++) {
        list.push({ d: i * 0.22, e: () => new Enemy('drone', {
          from: { x: -36, y: 140 }, c1: { x: LW * 0.3, y: 330 }, c2: { x: LW * 0.78, y: 50 },
          slot: { x: cx - 32 - i * 40, y: 120 }, dur: 1.9,
        }) });
        list.push({ d: i * 0.22 + 0.11, e: () => new Enemy('drone', {
          from: { x: LW + 36, y: 140 }, c1: { x: LW * 0.7, y: 330 }, c2: { x: LW * 0.22, y: 50 },
          slot: { x: cx + 32 + i * 40, y: 172 }, dur: 1.9,
        }) });
      }
      waves.push({ name: 'WAVE 1', sub: 'the donuts have found you', list });
    }

    // W2 — toilet line + donut curtain; gift: scatter
    {
      const list = [{ d: 0.3, gift: 'scatter' }];
      for (let i = 0; i < 3; i++) {
        list.push({ d: 0.2 + i * 0.3, e: () => new Enemy('sentry', {
          from: { x: cx + (i - 1) * 60, y: -50 }, slot: { x: cx + (i - 1) * 112, y: 108 }, dur: 1.6,
        }) });
      }
      for (let i = 0; i < 6; i++) {
        list.push({ d: 1 + i * 0.18, e: () => new Enemy('drone', {
          from: { x: i % 2 ? -36 : LW + 36, y: 90 },
          slot: { x: 60 + (i * (LW - 120)) / 5, y: 205 }, dur: 1.7,
        }) });
      }
      waves.push({ name: 'WAVE 2', sub: 'toilets inbound · sprinkle spray acquired', list });
    }

    // W3 — snot blobs + pickles; gift: anchovies
    {
      const list = [{ d: 0.4, gift: 'missile' }];
      for (let i = 0; i < 4; i++) {
        list.push({ d: 0.5 + i * 0.9, e: () => new Enemy('splitter', {
          from: { x: U.rand(50, LW - 50), y: -40 },
          slot: { x: U.rand(60, LW - 60), y: U.rand(60, 120) }, dur: 1.2,
        }) });
      }
      for (let i = 0; i < 3; i++) {
        list.push({ d: 1.5 + i * 1.1, e: () => new Enemy('diver', {
          from: { x: i % 2 ? -30 : LW + 30, y: 60 },
          slot: { x: U.rand(80, LW - 80), y: 90 }, dur: 1.2,
          diveDelay: U.rand(0.6, 1.6),
        }) });
      }
      waves.push({ name: 'WAVE 3', sub: 'snot blobs split. ew. just... ew', list });
    }

    // W4 — classic invader grid + flanking toilets; gift: mustard beam
    {
      const list = [{ d: 0.4, gift: 'beam' }];
      const cols = 6, rows = 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sx = cx + (c - (cols - 1) / 2) * 52, sy = 88 + r * 46;
          list.push({ d: (r * cols + c) * 0.08, e: () => new Enemy('drone', {
            from: { x: sx > cx ? LW + 40 : -40, y: -20 },
            slot: { x: sx, y: sy }, dur: 1.6, sway: 26,
          }) });
        }
      }
      list.push({ d: 2.2, e: () => new Enemy('sentry', { from: { x: -40, y: 240 }, slot: { x: 70, y: 235 }, dur: 1.4 }) });
      list.push({ d: 2.4, e: () => new Enemy('sentry', { from: { x: LW + 40, y: 240 }, slot: { x: LW - 70, y: 235 }, dur: 1.4 }) });
      waves.push({ name: 'WAVE 4', sub: 'a dozen donuts. classic formation', list });
    }

    // W5 — pickle rush + chaos
    {
      const list = [];
      for (let i = 0; i < 6; i++) {
        list.push({ d: i * 0.5, e: () => new Enemy('diver', {
          from: { x: i % 2 ? -30 : LW + 30, y: 50 + (i % 3) * 30 },
          slot: { x: U.rand(60, LW - 60), y: 80 + (i % 3) * 30 }, dur: 1.1,
          diveDelay: U.rand(0.4, 1.2),
        }) });
      }
      for (let i = 0; i < 3; i++) {
        list.push({ d: 0.8 + i * 0.8, e: () => new Enemy('splitter', {
          from: { x: U.rand(50, LW - 50), y: -40 },
          slot: { x: U.rand(60, LW - 60), y: U.rand(50, 110) }, dur: 1.1,
        }) });
      }
      list.push({ d: 2, e: () => new Enemy('sentry', { from: { x: cx, y: -50 }, slot: { x: cx, y: 128 }, dur: 1.4 }) });
      waves.push({ name: 'WAVE 5', sub: 'last call before the big flush', list });
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
          g.banner('⚠ TOILET OVERLORD ⚠', 'something huge just clogged the sector', true);
          Sfx.alarm();
          this.queue = [{ d: 2.2, boss: true }];
        }
      }
    }
  },
};
