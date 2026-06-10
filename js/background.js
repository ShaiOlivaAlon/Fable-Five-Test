'use strict';

/* Parallax top-down cyberpunk megacity: 3 generated layers + fog + hover-car streaks. */
const BG = {
  layers: [], fog: [], cars: [], LW: 0, LH: 0,

  init(LW, LH, res) {
    this.LW = LW;
    this.LH = LH;
    res = U.clamp(res || 1, 1, 2);
    this.layers = [
      { c: this.city(LW, LH * 2, 0, res), h: LH * 2, y: 0, speed: 14, alpha: 1 },
      { c: this.city(LW, LH * 2, 1, res), h: LH * 2, y: 0, speed: 36, alpha: 0.9 },
      { c: this.city(LW, LH * 2, 2, res), h: LH * 2, y: 0, speed: 74, alpha: 0.85 },
    ];
    this.fog = [];
    for (let i = 0; i < 5; i++) {
      this.fog.push({
        x: U.rand(LW), y: U.rand(LH), r: U.rand(120, 260),
        vx: U.rand(-8, 8), vy: U.rand(20, 45),
        sprite: U.pick(['#7828c8', '#1478c8', '#c81e78']),
      });
    }
    this.cars = [];
    for (let i = 0; i < 10; i++) this.cars.push(this.newCar(true));
  },

  newCar(anywhere) {
    return {
      x: U.rand(this.LW), y: anywhere ? U.rand(this.LH) : -16,
      v: U.rand(160, 330), len: U.rand(8, 16),
      color: U.pick(['#ffd28a', '#7df9ff', '#ff71ce', '#ffffff']),
    };
  },

  city(w, h, depth, res) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * res);
    c.height = Math.ceil(h * res);
    const x = c.getContext('2d');
    x.scale(res, res);

    const cell = depth === 0 ? 36 : depth === 1 ? 64 : 110;
    if (depth === 0) {
      const base = x.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#050310');
      base.addColorStop(0.5, '#070418');
      base.addColorStop(1, '#04020c');
      x.fillStyle = base;
      x.fillRect(0, 0, w, h);
    }

    // street grid with the occasional glowing main avenue
    x.lineWidth = depth === 0 ? 1 : 1.6;
    const grid = (vertical) => {
      const lim = vertical ? w : h;
      for (let g = 0; g <= lim; g += cell) {
        if (Math.random() < (depth === 0 ? 0.45 : 0.3)) continue;
        const main = Math.random() < 0.12;
        x.strokeStyle = main
          ? U.pick(['rgba(64,240,255,0.20)', 'rgba(255,77,216,0.16)'])
          : 'rgba(90,140,255,0.05)';
        x.shadowColor = '#41f0ff';
        x.shadowBlur = main ? 6 : 0;
        x.beginPath();
        if (vertical) { x.moveTo(g + 0.5, 0); x.lineTo(g + 0.5, h); }
        else { x.moveTo(0, g + 0.5); x.lineTo(w, g + 0.5); }
        x.stroke();
      }
    };
    grid(false);
    grid(true);
    x.shadowBlur = 0;

    // building blocks with lit windows + neon roof edges
    const n = depth === 0 ? 130 : depth === 1 ? 60 : 18;
    for (let i = 0; i < n; i++) {
      const bw = U.rand(cell * 0.5, cell * 1.6), bh = U.rand(cell * 0.5, cell * 1.6);
      const bx = U.rand(w - bw), by = U.rand(h - bh);
      const tone = depth === 2 ? 26 : 16;
      const g = x.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, `rgb(${tone},${tone - 6},${tone + 14})`);
      g.addColorStop(1, `rgb(${tone - 8},${tone - 12},${tone + 2})`);
      x.fillStyle = g;
      x.globalAlpha = depth === 0 ? 1 : 0.92;
      x.fillRect(bx, by, bw, bh);
      if (Math.random() < 0.3) {
        x.strokeStyle = U.pick([
          'rgba(64,240,255,0.35)', 'rgba(255,77,216,0.3)',
          'rgba(255,160,60,0.3)', 'rgba(120,255,140,0.25)',
        ]);
        x.lineWidth = 1;
        x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      }
      const wn = (bw * bh) / 140;
      for (let k = 0; k < wn; k++) {
        x.fillStyle = U.pick([
          'rgba(255,220,150,0.5)', 'rgba(125,249,255,0.45)',
          'rgba(255,113,206,0.4)', 'rgba(200,220,255,0.3)',
        ]);
        x.fillRect(bx + U.rand(2, Math.max(3, bw - 3)), by + U.rand(2, Math.max(3, bh - 3)), U.rand(1, 2.4), U.rand(1, 2.4));
      }
      x.globalAlpha = 1;
    }

    // big billboard glows on the near layer
    if (depth === 2) {
      for (let i = 0; i < 7; i++) {
        const gx = U.rand(w), gy = U.rand(h), gr = U.rand(26, 60);
        const col = U.pick(['255,77,216', '64,240,255', '255,160,60']);
        const rg = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
        rg.addColorStop(0, `rgba(${col},0.22)`);
        rg.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = rg;
        x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
    }
    return c;
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
    for (const car of this.cars) {
      car.y += car.v * dt;
      if (car.y > this.LH + 20) Object.assign(car, this.newCar(false));
    }
  },

  draw(ctx) {
    const { LW, LH } = this;
    // overdraw so screen-shake never exposes raw canvas edges
    ctx.fillStyle = '#050310';
    ctx.fillRect(-40, -40, LW + 80, LH + 80);

    for (const L of this.layers) {
      ctx.globalAlpha = L.alpha;
      const y0 = (L.y % L.h) - L.h;
      ctx.drawImage(L.c, 0, y0, LW, L.h);
      ctx.drawImage(L.c, 0, y0 + L.h, LW, L.h);
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    for (const car of this.cars) {
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(car.x, car.y - car.len);
      ctx.stroke();
      ctx.drawImage(U.glow(car.color), car.x - 4, car.y - 4, 8, 8);
    }
    ctx.globalAlpha = 0.06;
    for (const f of this.fog) {
      ctx.drawImage(U.glow(f.sprite), f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};
