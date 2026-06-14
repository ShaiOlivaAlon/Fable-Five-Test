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
    ui: 'assets/ui.png',
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
  // ---- enemies.png : the animated-strip sheet, read as 3 column-groups x 5 rows.
  //      row1 [burger][PIZZA=player][pickle]  row2 [banana][trashbag][condom]
  //      row3 [toilet][cheese][meatball]      row4 [donuts][chef][virus]
  //      row5 = BOSSES (7 across). Values are visual estimates — calibrate. ----
  player:        { sheet: 'enemies', fx: 0.35,  fy: 0.01, fw: 0.060, fh: 0.18, n: 5, fps: 10, h: 60 },
  enemy_drone:   { sheet: 'enemies', fx: 0.01,  fy: 0.01, fw: 0.062, fh: 0.18, n: 5, fps: 8,  h: 34 }, // burger
  enemy_sentry:  { sheet: 'enemies', fx: 0.01,  fy: 0.41, fw: 0.062, fh: 0.18, n: 5, fps: 6,  h: 42 }, // toilet cannon
  enemy_splitter:{ sheet: 'enemies', fx: 0.68,  fy: 0.41, fw: 0.080, fh: 0.18, n: 4, fps: 8,  h: 34 }, // meatball
  enemy_mite:    { sheet: 'enemies', fx: 0.68,  fy: 0.60, fw: 0.080, fh: 0.18, n: 4, fps: 10, h: 20 }, // virus
  enemy_diver:   { sheet: 'enemies', fx: 0.005, fy: 0.21, fw: 0.052, fh: 0.18, n: 6, fps: 12, h: 30 }, // banana
  boss:          { sheet: 'enemies', fx: 0.43,  fy: 0.79, fw: 0.135, fh: 0.205, n: 1, fps: 0, h: 220 }, // toilet king

  // ---- projectiles.png ----
  bullet_pulse:  { sheet: 'projectiles', fx: 0.0,   fy: 0.04, fw: 0.072, fh: 0.16,  n: 5, fps: 14, h: 24 }, // pizza slices
  bullet_scatter:{ sheet: 'projectiles', fx: 0.355, fy: 0.30, fw: 0.063, fh: 0.115, n: 4, fps: 14, h: 14 }, // slime balls
  bullet_missile:{ sheet: 'projectiles', fx: 0.92,  fy: 0.80, fw: 0.07,  fh: 0.12,  n: 1, fps: 0,  h: 18 }, // fish

  // ---- ui.png (Sheet 05) : bubbled power-up icons, 3 rows x 5 cols, top-right.
  //      r1 [pickle][TP][pizza][battery][donut]  r2 [sock][plunger][hotsauce][banana][spray] ----
  pick_scatter:  { sheet: 'ui', fx: 0.895, fy: 0.052, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // donut
  pick_repair:   { sheet: 'ui', fx: 0.705, fy: 0.052, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // pizza
  pick_mult:     { sheet: 'ui', fx: 0.800, fy: 0.052, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // battery
  pick_shield:   { sheet: 'ui', fx: 0.895, fy: 0.122, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // spray
  pick_over:     { sheet: 'ui', fx: 0.705, fy: 0.122, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // hot sauce
  pick_beam:     { sheet: 'ui', fx: 0.610, fy: 0.122, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // plunger
  pick_missile:  { sheet: 'ui', fx: 0.800, fy: 0.122, fw: 0.075, fh: 0.052, n: 1, fps: 0, h: 30 }, // banana
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
