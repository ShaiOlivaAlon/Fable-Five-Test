'use strict';

/* ---------------------------------------------------------------------------
   Image-asset pipeline for the painted "Space Grossers" sprite sheets.

   The game ships with fully procedural art (entities.js / enemies.js draw
   everything with canvas paths). This layer lets the real illustrated sprite
   sheets take over WHEN — and only when — the PNG files are present in
   /assets. If a sheet is missing or still loading, every draw call falls back
   to the procedural art, so the game always runs.

   To enable the painted art, drop these files into /assets (see assets/README):
     items.png        — pizza boxes, toilets, bananas, sprays, socks, icons
     creatures.png    — "ENEMY CREATURES" sheet (jars, bags, saucers, ...)
     projectiles.png  — "PROJECTILES" sheet (pizza, TP, sponge, slime, beams)
     enemies.png      — animated enemy strips + the BOSSES row
     bg.png           — the tall vertical psychedelic background

   FRAMES coordinates are NORMALISED (0..1 of each sheet's width/height) so they
   can be authored by eye from the reference images and stay resolution
   independent. They are first-pass estimates and meant to be calibrated in this
   one file once the real PNGs (with known pixel sizes) are committed.
--------------------------------------------------------------------------- */

const Assets = {
  SHEETS: {
    items: 'assets/items.png',
    creatures: 'assets/creatures.png',
    projectiles: 'assets/projectiles.png',
    enemies: 'assets/enemies.png',
    bg: 'assets/bg.png',
  },

  imgs: {},
  done: false,

  load(cb) {
    const names = Object.keys(this.SHEETS);
    let left = names.length;
    if (!left) { this.done = true; cb && cb(); return; }
    for (const name of names) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        if (--left === 0) { this.done = true; cb && cb(); }
      };
      img.src = this.SHEETS[name];
      this.imgs[name] = img;
    }
  },

  ok(name) {
    const img = this.imgs[name];
    return !!(img && img.complete && img.naturalWidth > 1);
  },
};

/* Per-sprite frame table. Each entry:
     sheet : which SHEETS image
     fx,fy : normalised top-left of the FIRST frame
     fw,fh : normalised size of one frame
     n     : number of horizontal frames in the strip
     fps   : animation speed (0 = static, show frame 0)
     h     : desired on-screen height in world units (width follows aspect)
   Coordinates are best-guess from the reference sheets — calibrate here. */
const FRAMES = {
  // player — pizza-slice rocket strip (enemies.png "pizza ships" row)
  player:        { sheet: 'enemies', fx: 0.34, fy: 0.02, fw: 0.066, fh: 0.165, n: 5, fps: 10, h: 60 },

  // enemies (enemies.png animated strips)
  enemy_drone:   { sheet: 'enemies', fx: 0.66, fy: 0.205, fw: 0.066, fh: 0.165, n: 5, fps: 8, h: 32 }, // pickle row stand-in
  enemy_sentry:  { sheet: 'enemies', fx: 0.0,  fy: 0.40,  fw: 0.083, fh: 0.165, n: 5, fps: 6, h: 40 }, // toilet cannons
  enemy_splitter:{ sheet: 'enemies', fx: 0.34, fy: 0.595, fw: 0.083, fh: 0.165, n: 4, fps: 8, h: 34 }, // chef blobs
  enemy_mite:    { sheet: 'enemies', fx: 0.34, fy: 0.595, fw: 0.083, fh: 0.165, n: 4, fps: 8, h: 20 },
  enemy_diver:   { sheet: 'enemies', fx: 0.66, fy: 0.205, fw: 0.066, fh: 0.165, n: 5, fps: 12, h: 28 }, // pickle row

  // boss — Toilet Overlord (enemies.png BOSSES row, the crowned toilet king)
  boss:          { sheet: 'enemies', fx: 0.43, fy: 0.79,  fw: 0.14,  fh: 0.205, n: 1, fps: 0, h: 220 },

  // player projectiles (projectiles.png)
  bullet_pulse:  { sheet: 'projectiles', fx: 0.0,  fy: 0.02, fw: 0.07, fh: 0.13, n: 5, fps: 14, h: 22 }, // pizza slices
  bullet_scatter:{ sheet: 'projectiles', fx: 0.36, fy: 0.30, fw: 0.05, fh: 0.10, n: 4, fps: 14, h: 14 }, // slime balls
  bullet_missile:{ sheet: 'projectiles', fx: 0.94, fy: 0.82, fw: 0.05, fh: 0.10, n: 1, fps: 0,  h: 18 }, // little fish

  // boosts / pickups (items.png icon row)
  pick_shield:   { sheet: 'items', fx: 0.13, fy: 0.66, fw: 0.07, fh: 0.12, n: 1, fps: 0, h: 28 }, // TP roll
  pick_over:     { sheet: 'items', fx: 0.30, fy: 0.66, fw: 0.07, fh: 0.12, n: 1, fps: 0, h: 28 }, // detergent pod
  pick_mult:     { sheet: 'items', fx: 0.47, fy: 0.66, fw: 0.06, fh: 0.12, n: 1, fps: 0, h: 28 }, // battery
  pick_repair:   { sheet: 'items', fx: 0.62, fy: 0.66, fw: 0.07, fh: 0.12, n: 1, fps: 0, h: 28 }, // sponge
  pick_scatter:  { sheet: 'items', fx: 0.0,  fy: 0.66, fw: 0.07, fh: 0.12, n: 1, fps: 0, h: 28 }, // pizza slice
  pick_beam:     { sheet: 'items', fx: 0.62, fy: 0.66, fw: 0.07, fh: 0.12, n: 1, fps: 0, h: 28 },
  pick_missile:  { sheet: 'items', fx: 0.30, fy: 0.66, fw: 0.07, fh: 0.12, n: 1, fps: 0, h: 28 },
};

/* Sprite blitter. Call inside a transform already translated to the entity's
   origin; draws the sprite centred on (0,0). Returns true if it actually drew
   (sheet present + frame defined), false so the caller can fall back. */
const SPR = {
  enabled: true,

  ok(key) {
    if (!this.enabled) return false;
    const f = FRAMES[key];
    return !!(f && Assets.ok(f.sheet));
  },

  // draw centred at the current transform origin, scaled to f.h * scale
  local(ctx, key, t = 0, scale = 1) {
    const f = FRAMES[key];
    if (!f || !Assets.ok(f.sheet)) return false;
    const img = Assets.imgs[f.sheet];
    const W = img.naturalWidth, H = img.naturalHeight;
    const sw = f.fw * W, sh = f.fh * H;
    const frame = f.fps > 0 ? (Math.floor(t * f.fps) % f.n) : 0;
    const sx = f.fx * W + frame * sw, sy = f.fy * H;
    const dh = f.h * scale, dw = dh * (sw / sh);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    return true;
  },

  // white hit-flash overlay sized to a sprite (approximate, additive)
  flash(ctx, key, scale = 1) {
    const f = FRAMES[key];
    if (!f) return;
    const dh = f.h * scale, dw = dh;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(U.glow('#ffffff'), -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  },
};
