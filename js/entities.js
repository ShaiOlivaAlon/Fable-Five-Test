'use strict';

const WEAPONS = {
  pulse:   { name: 'CHEEZ BLASTER',  color: '#ffb347', cd: 0.15 },
  scatter: { name: 'SPRINKLE SPRAY', color: '#ff4dd8', cd: 0.27 },
  beam:    { name: 'MUSTARD BEAM',   color: '#ffd02e', cd: 0 },
  missile: { name: 'HOMING ANCHOVY', color: '#9fd8e8', cd: 0.4 },
};

const BOOSTS = {
  shield:  { color: '#ff8ad8', label: 'GUM' },
  over:    { color: '#ff5e3a', label: 'HOT' },
  mult:    { color: '#c86bff', label: '×2' },
  repair:  { color: '#f0f0f0', label: 'TP' },
  scatter: { color: '#ff4dd8', label: 'SPR', weapon: true },
  beam:    { color: '#ffd02e', label: 'MUS', weapon: true },
  missile: { color: '#9fd8e8', label: 'FSH', weapon: true },
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
        color: this.over > 0 ? '#ff5e3a' : '#ffa033',
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
      this.muzzle('#ffb347');
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
      Particles.explosion(this.x, this.y, '#ff8ad8', 0.8);
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

    // rocket exhaust glow under the crust
    const fl = 1 + Math.sin(t * 40) * 0.25;
    const eg = ctx.createRadialGradient(0, 22, 0, 0, 22, 16 * fl);
    eg.addColorStop(0, 'rgba(255,250,210,0.9)');
    eg.addColorStop(0.4, this.over > 0 ? 'rgba(255,94,58,0.55)' : 'rgba(255,160,51,0.5)');
    eg.addColorStop(1, 'rgba(255,160,51,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(0, 24, 7 * fl, 16 * fl, 0, 0, U.TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // pizza slice, tip up: cheesy triangle body
    const slice = () => {
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.quadraticCurveTo(10, -8, 17, 12);
      ctx.lineTo(-17, 12);
      ctx.quadraticCurveTo(-10, -8, 0, -28);
      ctx.closePath();
    };
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 14;
    const cheese = ctx.createLinearGradient(0, -28, 0, 12);
    cheese.addColorStop(0, '#ffe89a');
    cheese.addColorStop(0.6, '#ffd34d');
    cheese.addColorStop(1, '#f0a83c');
    slice();
    ctx.fillStyle = cheese;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,120,40,0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // crust booster at the bottom, bumpy like a real crust
    ctx.shadowBlur = 8;
    const crust = ctx.createLinearGradient(0, 10, 0, 22);
    crust.addColorStop(0, '#d89a52');
    crust.addColorStop(1, '#9a601e');
    ctx.fillStyle = crust;
    ctx.beginPath();
    ctx.moveTo(-18, 11);
    ctx.arc(-9, 14, 6.4, Math.PI, 0, true);
    ctx.arc(0, 15, 6.4, Math.PI, 0, true);
    ctx.arc(9, 14, 6.4, Math.PI, 0, true);
    ctx.lineTo(18, 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,20,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // melty cheese drips along the edges
    ctx.fillStyle = '#ffd34d';
    for (const [dx, dy, dr] of [[-12.5, 9, 2.4], [13.5, 6, 2], [-7, -6, 1.7]]) {
      ctx.beginPath();
      ctx.ellipse(dx, dy + Math.sin(t * 4 + dx) * 0.7, dr * 0.8, dr * 1.5, 0, 0, U.TAU);
      ctx.fill();
    }

    // pepperoni armor
    for (const [px2, py2, pr] of [[0, -8, 3.2], [-7, 4, 2.8], [8, 3, 2.6]]) {
      const pg = ctx.createRadialGradient(px2 - 1, py2 - 1, 0, px2, py2, pr);
      pg.addColorStop(0, '#e85a4a');
      pg.addColorStop(1, '#a02a22');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px2, py2, pr, 0, U.TAU);
      ctx.fill();
    }

    // googly eyes near the tip, tracking the strafe
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#fff';
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s * 4.2, -16, 3, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1208';
      ctx.beginPath();
      ctx.arc(s * 4.2 + this.tilt * 1.6, -16.6, 1.4, 0, U.TAU);
      ctx.fill();
    }

    // hot-sauce overdrive aura
    if (this.over > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = baseA * (0.45 + Math.sin(t * 18) * 0.18);
      ctx.strokeStyle = '#ff5e3a';
      ctx.shadowColor = '#ff5e3a';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 32, 0, 0, U.TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // bubble-gum shield
    if (this.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(this.x, this.y);
      ctx.rotate(t * 0.8);
      ctx.globalAlpha = 0.55 + Math.sin(t * 6) * 0.15;
      ctx.strokeStyle = '#ff8ad8';
      ctx.shadowColor = '#ff8ad8';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      const sg = ctx.createRadialGradient(0, 0, 20, 0, 0, 34);
      sg.addColorStop(0, 'rgba(255,138,216,0)');
      sg.addColorStop(1, 'rgba(255,138,216,0.16)');
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

function blobPath(ctx, r, t, wob = 0.12) {
  ctx.beginPath();
  for (let i = 0; i <= 9; i++) {
    const a = (i / 9) * U.TAU;
    const rr = r * (1 + wob * Math.sin(t * 5 + i * 2.2));
    const px = rr * Math.cos(a), py = rr * Math.sin(a);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
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
    ctx.fillStyle = 'rgba(18,8,30,0.85)';
    blobPath(ctx, 14, this.t);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    blobPath(ctx, 9.5, this.t + 1.3, 0.16);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // dangling drip
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(3, 15 + Math.sin(this.t * 5) * 1.4, 1.6, 2.6, 0, 0, U.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
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
    // flying cheese glob with a melty tail
    ctx.drawImage(U.glow('#ffb347'), -9, -12, 18, 18);
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.ellipse(0, -3, 3.4, 5.4, 0, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 4, 1.8, 2.8, 0, 0, U.TAU);
    ctx.fill();
  } else if (b.type === 'scatter') {
    // candy sprinkle
    ctx.drawImage(U.glow('#ff4dd8'), -9, -9, 18, 18);
    ctx.fillStyle = `hsl(${b.hue},90%,68%)`;
    ctx.beginPath();
    ctx.roundRect(-1.9, -5.5, 3.8, 11, 1.9);
    ctx.fill();
  } else if (b.type === 'missile') {
    // homing anchovy, nose first, tail flapping
    ctx.drawImage(U.glow('#7df9ff'), -8, 0, 16, 16);
    const fg = ctx.createLinearGradient(-4, 0, 4, 0);
    fg.addColorStop(0, '#88aebc');
    fg.addColorStop(0.5, '#cfe8f0');
    fg.addColorStop(1, '#88aebc');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, -1, 3.6, 8.5, 0, 0, U.TAU);
    ctx.fill();
    const flap = Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(3.5 + flap, 12);
    ctx.lineTo(-3.5 - flap, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0a1418';
    ctx.beginPath();
    ctx.arc(1.3, -6, 0.9, 0, U.TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemyBullet(ctx, b, t) {
  ctx.globalCompositeOperation = 'lighter';
  // orb = snot loogie, orb2 = something best left unidentified
  const col = b.type === 'orb2' ? '#c9803a' : '#8aff3a';
  const r = (b.r + 4) * (1.6 + Math.sin(t * 20) * 0.12);
  ctx.drawImage(U.glow(col), b.x - r, b.y - r, r * 2, r * 2);
  ctx.fillStyle = b.type === 'orb2' ? '#e8c89a' : '#e4ffc0';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 0.55, 0, U.TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
