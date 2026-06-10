'use strict';

const WEAPONS = {
  pulse:   { name: 'PULSE BLASTER', color: '#41f0ff', cd: 0.15 },
  scatter: { name: 'SCATTER ARRAY', color: '#ff4dd8', cd: 0.27 },
  beam:    { name: 'RAILBEAM',      color: '#b7ff2e', cd: 0 },
  missile: { name: 'HOMING MX-9',   color: '#ffb347', cd: 0.4 },
};

const BOOSTS = {
  shield:  { color: '#41f0ff', label: 'SH' },
  over:    { color: '#ffd84d', label: 'OD' },
  mult:    { color: '#ff4dd8', label: '×2' },
  repair:  { color: '#6dff8a', label: '++' },
  scatter: { color: '#ff4dd8', label: 'SC', weapon: true },
  beam:    { color: '#b7ff2e', label: 'RB', weapon: true },
  missile: { color: '#ffb347', label: 'MX', weapon: true },
};

class Player {
  constructor(g) {
    this.g = g;
    this.reset();
  }

  reset() {
    const g = this.g;
    this.x = g.LW / 2;
    this.y = g.LH - 120;
    this.hp = 3;
    this.maxHp = 4;
    this.inv = 0;
    this.tilt = 0;
    this.weapon = 'pulse';
    this.weaponT = 0;
    this.shield = 0;
    this.over = 0;
    this.mult = 1;
    this.multT = 0;
    this.fireCd = 0;
    this.beamSfx = 0;
    this.beamTick = 0;
    this.flameT = 0;
    this.alive = true;
  }

  update(dt) {
    const g = this.g;
    const d = Input.consume();
    const k = Input.axis();
    const spd = 340 * (this.over > 0 ? 1.3 : 1);
    const px = this.x;
    this.x += (d.x / g.scale) * 1.18 + k.x * spd * dt;
    this.y += (d.y / g.scale) * 1.18 + k.y * spd * dt;
    this.x = U.clamp(this.x, 24, g.LW - 24);
    this.y = U.clamp(this.y, g.LH * 0.4, g.LH - 46);
    const vx = (this.x - px) / Math.max(dt, 0.001);
    this.tilt = U.lerp(this.tilt, U.clamp(vx / 480, -1, 1), Math.min(1, dt * 10));

    if (this.inv > 0) this.inv -= dt;
    if (this.over > 0) this.over -= dt;
    if (this.multT > 0) { this.multT -= dt; if (this.multT <= 0) this.mult = 1; }
    if (this.weaponT > 0) { this.weaponT -= dt; if (this.weaponT <= 0) this.weapon = 'pulse'; }

    this.flameT -= dt;
    if (this.flameT <= 0) {
      this.flameT = 0.02;
      Particles.spawn({
        x: this.x + U.rand(-3, 3), y: this.y + 24,
        vx: U.rand(-14, 14), vy: U.rand(140, 220),
        color: this.over > 0 ? '#ffd84d' : '#41f0ff',
        type: 'flame', size: U.rand(2, 4.5), life: U.rand(0.18, 0.34), glow: 10, drag: 0.4,
      });
    }

    this.fireCd -= dt;
    if (this.weapon === 'beam') {
      this.beamSfx -= dt;
      if (this.beamSfx <= 0) { this.beamSfx = 0.14; Sfx.shoot('beam'); }
    } else if (this.fireCd <= 0) {
      this.fire();
    }
  }

  fire() {
    const g = this.g, w = this.weapon;
    const rapid = this.over > 0 ? 0.55 : 1;
    if (w === 'pulse') {
      this.fireCd = WEAPONS.pulse.cd * rapid;
      g.pbullets.push(g.bullet(this.x - 10, this.y - 14, 0, -860, 10, 'pulse'));
      g.pbullets.push(g.bullet(this.x + 10, this.y - 14, 0, -860, 10, 'pulse'));
      this.muzzle('#41f0ff');
      Sfx.shoot('pulse');
    } else if (w === 'scatter') {
      this.fireCd = WEAPONS.scatter.cd * rapid;
      for (let i = -2; i <= 2; i++) {
        const a = -Math.PI / 2 + i * 0.16;
        g.pbullets.push(g.bullet(this.x, this.y - 18, Math.cos(a) * 760, Math.sin(a) * 760, 7, 'scatter'));
      }
      this.muzzle('#ff4dd8');
      Sfx.shoot('scatter');
    } else if (w === 'missile') {
      this.fireCd = WEAPONS.missile.cd * rapid;
      for (const s of [-1, 1]) {
        g.pbullets.push(g.bullet(this.x + s * 14, this.y, s * 130, -420, 30, 'missile'));
      }
      Sfx.shoot('missile');
    }
  }

  muzzle(color) {
    Particles.spawn({ x: this.x, y: this.y - 22, vx: 0, vy: -60, color, size: 4, life: 0.08, glow: 16 });
  }

  hit() {
    if (this.inv > 0 || !this.alive) return;
    const g = this.g;
    if (this.shield > 0) {
      this.shield = 0;
      this.inv = 1;
      Particles.explosion(this.x, this.y, '#41f0ff', 0.8);
      Sfx.shieldPop();
      g.shake(7);
      U.vibrate(40);
      return;
    }
    this.hp--;
    this.inv = 1.7;
    Sfx.hurt();
    U.vibrate([60, 40, 60]);
    g.shake(14);
    g.flash('rgba(255,40,60,0.25)');
    Particles.explosion(this.x, this.y, '#ff3b5c', 1.1);
    if (this.hp <= 0) {
      this.alive = false;
      g.playerDestroyed();
    }
  }

  draw(ctx) {
    const g = this.g, t = g.time;
    const baseA = this.inv > 0 && ((t * 24) | 0) % 2 === 0 ? 0.35 : 1;
    ctx.save();
    ctx.globalAlpha = baseA;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt * 0.3);

    // engine glow
    const fl = 1 + Math.sin(t * 40) * 0.25;
    const eg = ctx.createRadialGradient(0, 22, 0, 0, 22, 16 * fl);
    eg.addColorStop(0, 'rgba(180,255,255,0.9)');
    eg.addColorStop(0.4, this.over > 0 ? 'rgba(255,216,77,0.55)' : 'rgba(64,240,255,0.5)');
    eg.addColorStop(1, 'rgba(64,240,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(0, 24, 7 * fl, 16 * fl, 0, 0, U.TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // hull
    ctx.shadowColor = '#41f0ff';
    ctx.shadowBlur = 14;
    const hull = ctx.createLinearGradient(0, -28, 0, 22);
    hull.addColorStop(0, '#dff6ff');
    hull.addColorStop(0.25, '#2e3a5e');
    hull.addColorStop(1, '#11142b');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.bezierCurveTo(4, -18, 5, -10, 6, -2);
    ctx.lineTo(22, 12);
    ctx.lineTo(20, 18);
    ctx.lineTo(7, 14);
    ctx.lineTo(4, 22);
    ctx.lineTo(-4, 22);
    ctx.lineTo(-7, 14);
    ctx.lineTo(-20, 18);
    ctx.lineTo(-22, 12);
    ctx.lineTo(-6, -2);
    ctx.bezierCurveTo(-5, -10, -4, -18, 0, -28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(64,240,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // cockpit
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#9ff7ff';
    const cg = ctx.createLinearGradient(0, -14, 0, 0);
    cg.addColorStop(0, '#d8fbff');
    cg.addColorStop(1, '#1899c9');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(0, -8, 3.4, 7.5, 0, 0, U.TAU);
    ctx.fill();

    // wingtip lights
    ctx.shadowColor = '#ff4dd8';
    ctx.shadowBlur = 9;
    ctx.fillStyle = '#ff4dd8';
    ctx.beginPath();
    ctx.arc(-20.5, 14.5, 1.8, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20.5, 14.5, 1.8, 0, U.TAU);
    ctx.fill();

    // overdrive aura
    if (this.over > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = baseA * (0.45 + Math.sin(t * 18) * 0.18);
      ctx.strokeStyle = '#ffd84d';
      ctx.shadowColor = '#ffd84d';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 32, 0, 0, U.TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // shield bubble
    if (this.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(this.x, this.y);
      ctx.rotate(t * 0.8);
      ctx.globalAlpha = 0.55 + Math.sin(t * 6) * 0.15;
      ctx.strokeStyle = '#41f0ff';
      ctx.shadowColor = '#41f0ff';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      const sg = ctx.createRadialGradient(0, 0, 20, 0, 0, 34);
      sg.addColorStop(0, 'rgba(64,240,255,0)');
      sg.addColorStop(1, 'rgba(64,240,255,0.16)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

function hexPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * U.TAU - Math.PI / 2;
    if (i) ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    else ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
  }
  ctx.closePath();
}

class PowerUp {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.t = U.rand(U.TAU);
    this.vy = 64;
    this.r = 15;
    this.dead = false;
  }

  update(dt, g) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 2.2) * 24 * dt;
    if (this.y > g.LH + 30) this.dead = true;
  }

  draw(ctx) {
    const b = BOOSTS[this.kind];
    ctx.save();
    ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(this.t * 5) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.sin(this.t * 1.8) * 0.25);
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(8,10,30,0.85)';
    hexPath(ctx, 14);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    hexPath(ctx, 9.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    ctx.font = '700 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, 0, 0.5);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function drawBullet(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
  ctx.globalCompositeOperation = 'lighter';
  if (b.type === 'pulse') {
    ctx.drawImage(U.glow('#41f0ff'), -9, -12, 18, 18);
    ctx.fillStyle = '#e8feff';
    ctx.beginPath();
    ctx.roundRect(-2, -10, 4, 15, 2);
    ctx.fill();
  } else if (b.type === 'scatter') {
    ctx.drawImage(U.glow('#ff4dd8'), -9, -9, 18, 18);
    ctx.fillStyle = '#ffd9f4';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();
  } else if (b.type === 'missile') {
    ctx.drawImage(U.glow('#ffb347'), -8, 0, 16, 16);
    ctx.fillStyle = '#2a2438';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 7);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,120,0.9)';
    ctx.beginPath();
    ctx.moveTo(-2, 7);
    ctx.lineTo(0, 13 + Math.random() * 4);
    ctx.lineTo(2, 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemyBullet(ctx, b, t) {
  ctx.globalCompositeOperation = 'lighter';
  const col = b.type === 'orb2' ? '#ff8a3d' : '#ff3b5c';
  const r = (b.r + 4) * (1.6 + Math.sin(t * 20) * 0.12);
  ctx.drawImage(U.glow(col), b.x - r, b.y - r, r * 2, r * 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 0.55, 0, U.TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
