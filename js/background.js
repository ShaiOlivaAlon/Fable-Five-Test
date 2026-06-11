'use strict';

/* Parallax psychedelic gross-space: 3 generated layers of nebula goo, swirls and
   eyeball planets + drifting haze + falling slime drips. */
const BG = {
  layers: [], fog: [], drips: [], LW: 0, LH: 0,

  init(LW, LH, res) {
    this.LW = LW;
    this.LH = LH;
    res = U.clamp(res || 1, 1, 2);
    this.layers = [
      { c: this.psych(LW, LH * 2, 0, res), h: LH * 2, y: 0, speed: 14, alpha: 1 },
      { c: this.psych(LW, LH * 2, 1, res), h: LH * 2, y: 0, speed: 36, alpha: 0.9 },
      { c: this.psych(LW, LH * 2, 2, res), h: LH * 2, y: 0, speed: 74, alpha: 0.85 },
    ];
    this.fog = [];
    for (let i = 0; i < 5; i++) {
      this.fog.push({
        x: U.rand(LW), y: U.rand(LH), r: U.rand(120, 260),
        vx: U.rand(-8, 8), vy: U.rand(20, 45),
        sprite: U.pick(['#b03ce8', '#3ce86b', '#e83ca0']),
      });
    }
    this.drips = [];
    for (let i = 0; i < 10; i++) this.drips.push(this.newDrip(true));
  },

  newDrip(anywhere) {
    return {
      x: U.rand(this.LW), y: anywhere ? U.rand(this.LH) : -16,
      v: U.rand(160, 330), len: U.rand(8, 16),
      color: U.pick(['#8aff3a', '#5ee85e', '#ff71ce', '#d8ff7a']),
    };
  },

  psych(w, h, depth, res) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * res);
    c.height = Math.ceil(h * res);
    const x = c.getContext('2d');
    x.scale(res, res);

    if (depth === 0) {
      const base = x.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#16041f');
      base.addColorStop(0.35, '#0e0a2a');
      base.addColorStop(0.65, '#1c0628');
      base.addColorStop(1, '#0a0214');
      x.fillStyle = base;
      x.fillRect(0, 0, w, h);
    }

    // nebula goo splotches in acid colors
    const blobs = depth === 0 ? 26 : depth === 1 ? 14 : 7;
    for (let i = 0; i < blobs; i++) {
      const gx = U.rand(w), gy = U.rand(h);
      const gr = U.rand(40, depth === 0 ? 130 : 200);
      const hue = U.pick([285, 165, 320, 95, 25, 210]);
      const a = depth === 0 ? 0.1 : 0.14;
      const rg = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rg.addColorStop(0, `hsla(${hue},95%,55%,${a})`);
      rg.addColorStop(0.6, `hsla(${hue + 30},90%,45%,${a * 0.5})`);
      rg.addColorStop(1, 'hsla(0,0%,0%,0)');
      x.fillStyle = rg;
      x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }

    // trippy vortex swirls
    const swirls = depth === 0 ? 6 : depth === 1 ? 4 : 2;
    for (let i = 0; i < swirls; i++) {
      const cx2 = U.rand(w), cy2 = U.rand(h);
      const hue = U.rand(360) | 0;
      const arms = 2 + ((Math.random() * 2) | 0);
      const grow = U.rand(2.2, depth === 2 ? 6.5 : 4);
      const turns = U.rand(2, 3.4);
      x.lineWidth = depth === 2 ? 2.4 : 1.4;
      x.lineCap = 'round';
      for (let arm = 0; arm < arms; arm++) {
        x.strokeStyle = `hsla(${(hue + arm * 40) % 360},95%,62%,${depth === 0 ? 0.12 : 0.18})`;
        x.beginPath();
        const off = (arm / arms) * U.TAU;
        for (let th = 0; th < U.TAU * turns; th += 0.16) {
          const r = th * grow;
          const px = cx2 + Math.cos(th + off) * r;
          const py = cy2 + Math.sin(th + off) * r * 0.85;
          if (th === 0) x.moveTo(px, py);
          else x.lineTo(px, py);
        }
        x.stroke();
      }
    }

    // candy-colored stars
    const stars = depth === 0 ? 110 : depth === 1 ? 50 : 18;
    for (let i = 0; i < stars; i++) {
      x.fillStyle = U.pick([
        'rgba(255,255,255,0.7)', 'rgba(138,255,58,0.65)',
        'rgba(255,113,206,0.6)', 'rgba(125,249,255,0.6)', 'rgba(255,216,77,0.55)',
      ]);
      const sr = U.rand(0.6, depth === 2 ? 2.2 : 1.4);
      x.beginPath();
      x.arc(U.rand(w), U.rand(h), sr, 0, U.TAU);
      x.fill();
    }

    // bloodshot eyeball planets — they are always watching
    const eyes = depth === 0 ? 0 : depth === 1 ? 3 : 2;
    for (let i = 0; i < eyes; i++) {
      this.eyeball(x, U.rand(40, w - 40), U.rand(40, h - 40),
        depth === 2 ? U.rand(22, 38) : U.rand(9, 16));
    }

    // floating space chunks (asteroid boogers) on the near layer
    if (depth === 2) {
      for (let i = 0; i < 8; i++) {
        const bx = U.rand(w), by = U.rand(h), br = U.rand(4, 11);
        x.fillStyle = U.pick(['#3e5a22', '#54421e', '#4a2a4e']);
        x.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * U.TAU;
          const rr = br * U.rand(0.7, 1.2);
          if (k) x.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
          else x.moveTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
        }
        x.closePath();
        x.fill();
        x.fillStyle = 'rgba(160,220,90,0.25)';
        x.beginPath();
        x.arc(bx - br * 0.3, by - br * 0.3, br * 0.4, 0, U.TAU);
        x.fill();
      }
    }
    return c;
  },

  eyeball(x, ex, ey, r) {
    const hue = U.pick([95, 165, 285, 25]);
    const ball = x.createRadialGradient(ex - r * 0.3, ey - r * 0.3, 0, ex, ey, r);
    ball.addColorStop(0, '#f4f0e8');
    ball.addColorStop(0.75, '#cfc4b4');
    ball.addColorStop(1, '#8a7e6e');
    x.fillStyle = ball;
    x.beginPath();
    x.arc(ex, ey, r, 0, U.TAU);
    x.fill();
    // bloodshot veins
    x.strokeStyle = 'rgba(200,40,40,0.5)';
    x.lineWidth = Math.max(0.6, r * 0.04);
    for (let v = 0; v < 6; v++) {
      const a = U.rand(U.TAU);
      x.beginPath();
      x.moveTo(ex + Math.cos(a) * r * 0.95, ey + Math.sin(a) * r * 0.95);
      x.quadraticCurveTo(
        ex + Math.cos(a + 0.3) * r * 0.7, ey + Math.sin(a + 0.3) * r * 0.7,
        ex + Math.cos(a + 0.1) * r * 0.5, ey + Math.sin(a + 0.1) * r * 0.5,
      );
      x.stroke();
    }
    // iris + pupil, looking somewhere upsetting
    const la = U.rand(U.TAU), lx = ex + Math.cos(la) * r * 0.18, ly = ey + Math.sin(la) * r * 0.18;
    const iris = x.createRadialGradient(lx, ly, 0, lx, ly, r * 0.45);
    iris.addColorStop(0, `hsl(${hue},85%,60%)`);
    iris.addColorStop(0.8, `hsl(${hue},90%,32%)`);
    iris.addColorStop(1, `hsl(${hue},90%,20%)`);
    x.fillStyle = iris;
    x.beginPath();
    x.arc(lx, ly, r * 0.45, 0, U.TAU);
    x.fill();
    x.fillStyle = '#0a0608';
    x.beginPath();
    x.arc(lx, ly, r * 0.2, 0, U.TAU);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.beginPath();
    x.arc(lx - r * 0.1, ly - r * 0.12, r * 0.07, 0, U.TAU);
    x.fill();
  },

  update(dt) {
    for (const L of this.layers) L.y = (L.y + L.speed * dt) % L.h;
    for (const f of this.fog) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y - f.r > this.LH) { f.y = -f.r; f.x = U.rand(this.LW); }
      if (f.x < -f.r) f.x = this.LW + f.r;
      else if (f.x > this.LW + f.r) f.x = -f.r;
    }
    for (const d of this.drips) {
      d.y += d.v * dt;
      if (d.y > this.LH + 20) Object.assign(d, this.newDrip(false));
    }
  },

  draw(ctx) {
    const { LW, LH } = this;
    // overdraw so screen-shake never exposes raw canvas edges
    ctx.fillStyle = '#0e0318';
    ctx.fillRect(-40, -40, LW + 80, LH + 80);

    for (const L of this.layers) {
      ctx.globalAlpha = L.alpha;
      const y0 = (L.y % L.h) - L.h;
      ctx.drawImage(L.c, 0, y0, LW, L.h);
      ctx.drawImage(L.c, 0, y0 + L.h, LW, L.h);
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.drips) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y - d.len);
      ctx.stroke();
      ctx.drawImage(U.glow(d.color), d.x - 4, d.y - 4, 8, 8);
    }
    ctx.globalAlpha = 0.06;
    for (const f of this.fog) {
      ctx.drawImage(U.glow(f.sprite), f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};
