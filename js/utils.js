'use strict';

const U = {
  TAU: Math.PI * 2,
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  pick: arr => arr[(Math.random() * arr.length) | 0],
  dist2: (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angTo: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bezier: (p0, p1, p2, p3, t) => {
    const u = 1 - t, uu = u * u, tt = t * t;
    return {
      x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
      y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
    };
  },
  vibrate(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* unsupported */ } } },

  /* cached radial-glow sprites — far cheaper than canvas shadowBlur for the
     hundreds of particles/bullets drawn per frame */
  _glowCache: {},
  glow(color) {
    let c = U._glowCache[color];
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.22, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      U._glowCache[color] = c;
    }
    return c;
  },

  /* cached shaded-sphere sprites: top-left key light, specular hot spot,
     darkened limb — instant volume for bullets and orbs */
  _sphereCache: {},
  sphere(color) {
    let c = U._sphereCache[color];
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(22, 20, 2, 30, 30, 32);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.18, color);
      g.addColorStop(0.78, color);
      g.addColorStop(1, 'rgba(8,4,12,0.9)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(32, 32, 31, 0, Math.PI * 2);
      x.fill();
      U._sphereCache[color] = c;
    }
    return c;
  },

  /* cached soft black blob, used as a drop shadow to lift sprites off the
     background */
  _soft: null,
  soft() {
    if (!U._soft) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      U._soft = c;
    }
    return U._soft;
  },

  /* soft elevation shadow at an offset below-right of the light source */
  dropShadow(ctx, r, dx = 4, dy = 9, a = 0.4) {
    ctx.globalAlpha *= a;
    ctx.drawImage(U.soft(), dx - r * 1.25, dy - r * 1.05, r * 2.5, r * 2.1);
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha / a);
  },
};

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
