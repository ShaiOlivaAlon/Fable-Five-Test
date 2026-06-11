'use strict';

const Particles = {
  list: [],
  MAX: 340,

  spawn(o) {
    if (this.list.length >= this.MAX) this.list.shift();
    this.list.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.5, size: 3, color: '#41f0ff',
      type: 'spark', drag: 2.5, grav: 0, rot: Math.random() * U.TAU, vr: U.rand(-7, 7), glow: 14,
    }, o));
  },

  burst(x, y, color, n, speed, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(U.TAU), s = speed * U.rand(0.25, 1);
      this.spawn(Object.assign({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color,
        size: U.rand(1.5, 3.5), life: U.rand(0.25, 0.7),
      }, o));
    }
  },

  explosion(x, y, color, scale = 1) {
    this.burst(x, y, color, Math.round(13 * scale), 270 * scale);
    this.burst(x, y, '#ffffff', Math.round(5 * scale), 200 * scale, { life: 0.22, size: 2 });
    for (let i = 0; i < Math.round(4 * scale); i++) {
      const a = U.rand(U.TAU), s = U.rand(60, 190) * scale;
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, color, type: 'debris',
        size: U.rand(2, 5) * Math.min(scale, 1.6), life: U.rand(0.5, 1), grav: 320, drag: 1.2, glow: 6,
      });
    }
    for (let i = 0; i < Math.round(3 * scale); i++) {
      this.spawn({
        x: x + U.rand(-8, 8) * scale, y: y + U.rand(-8, 8) * scale,
        vx: U.rand(-25, 25), vy: U.rand(-45, -10),
        type: 'smoke', size: U.rand(8, 15) * scale, life: U.rand(0.7, 1.2), drag: 1, glow: 0,
      });
    }
    this.spawn({ x, y, type: 'ring', color, size: 64 * scale, life: 0.42, glow: 18 });
  },

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.t += dt;
      if (p.t >= p.life) { l[i] = l[l.length - 1]; l.pop(); continue; }
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr;
      p.vy = p.vy * dr + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  },

  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      if (p.type === 'spark' || p.type === 'flame') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * 0.95;
        const s = Math.max(0.8, p.size * (p.type === 'flame' ? k : 0.6 + 0.4 * k)) * 3.2;
        ctx.drawImage(U.glow(p.color), p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.type === 'debris') {
        // gooey chunk: squishy ellipse that stretches as it tumbles
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size / 2, p.size * 0.32, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.14 * k;
        const r = p.size * (1 + p.t * 1.6);
        ctx.drawImage(U.glow('#4e5a2e'), p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.type === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        const e = U.outCubic(p.t / p.life);
        ctx.globalAlpha = (1 - e) * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 4 * (1 - e));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + p.size * e, 0, U.TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

const Popups = {
  list: [],

  spawn(x, y, text, color = '#bfefff', size = 13) {
    this.list.push({ x, y, text, color, size, t: 0, life: 0.85 });
    if (this.list.length > 24) this.list.shift();
  },

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      l[i].t += dt;
      if (l[i].t >= l[i].life) { l[i] = l[l.length - 1]; l.pop(); }
    }
  },

  draw(ctx) {
    for (const p of this.list) {
      const k = p.t / p.life;
      const pop = p.t < 0.18 ? U.outBack(p.t / 0.18) : 1;
      ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.font = `700 ${Math.max(8, Math.round(p.size * pop))}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y - 26 * k);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  },
};
